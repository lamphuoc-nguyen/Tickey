import { afterEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpPaymentApi } from './payment-api';

const api = 'https://staging.example.test';
const back = `${api}/payments/return?booking_id=booking-a`;
const url = `${api}/payments/test/ORDER-1?${new URLSearchParams({ amount: '250000', return: back, sig: 'signed-by-server' })}`;
const payment = { bookingId: 'booking-a', paymentUrl: url, expiresAt: '2026-11-01T10:00:00Z' };
const auth = {
  auth: { getSession: async () => ({ data: { session: { access_token: 'test-user-token' } } }) },
} as unknown as SupabaseClient;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('posts the unchanged signed server fields to the existing TEST form endpoint', async () => {
  const fetcher = vi.fn(async () => new Response(null, { status: 303 }));
  vi.stubGlobal('fetch', fetcher);
  await new HttpPaymentApi(api, auth).confirmTestPayment(payment);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [target, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(target).toBe(`${api}/payments/test/ORDER-1`);
  expect(options.method).toBe('POST');
  expect(options.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
  expect(Object.fromEntries(new URLSearchParams(String(options.body)))).toEqual({
    amount: '250000',
    return: back,
    sig: 'signed-by-server',
    result: 'success',
  });
});

it.each([
  url.replace('staging.example.test/payments/test', 'untrusted.example.test/payments/test'),
  url.replace('/payments/test/', '/payments/real/'),
  url.replace('booking-a', 'booking-b'),
  url.replace('sig=signed-by-server', 'sig='),
  url.replace('amount=250000', 'amount=wrong'),
  `${url}&amount=1`,
])('rejects an invalid or unrelated checkout before making a request: %s', async (paymentUrl) => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(
    new HttpPaymentApi(api, auth).confirmTestPayment({ ...payment, paymentUrl }),
  ).rejects.toMatchObject({ code: 'UNKNOWN', details: { reason: 'INVALID_TEST_PAYMENT_URL' } });
  expect(fetcher).not.toHaveBeenCalled();
});

it('requires a signed-in user and never uses a backend secret', async () => {
  const guest = {
    auth: { getSession: async () => ({ data: { session: null } }) },
  } as unknown as SupabaseClient;
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  await expect(new HttpPaymentApi(api, guest).confirmTestPayment(payment)).rejects.toMatchObject({
    code: 'UNAUTHENTICATED',
  });
  expect(fetcher).not.toHaveBeenCalled();
});

it('preserves a signature rejection instead of claiming successful payment', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            message: 'FORBIDDEN',
            details: '{}',
          }),
          { status: 403 },
        ),
    ),
  );
  await expect(new HttpPaymentApi(api, auth).confirmTestPayment(payment)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  });
});

it('keeps a redirect/transport failure uncertain and does not retry the write', async () => {
  const fetcher = vi.fn(async () => {
    throw new TypeError('Cannot follow app scheme');
  });
  vi.stubGlobal('fetch', fetcher);
  await expect(new HttpPaymentApi(api, auth).confirmTestPayment(payment)).rejects.toMatchObject({
    code: 'NETWORK',
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([
  {
    code: 'PGRST202',
    message: 'Could not find the function public.get_payment_by_order_ref(p_order_ref) in the schema cache',
  },
  {
    message: 'Could not find the function public.get_payment_by_order_ref(p_order_ref) in the schema cache',
    details: 'Searched for the function in public',
  },
])('classifies an unavailable confirmation RPC without exposing database details', async (failure) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(failure), { status: 400 })),
  );
  await expect(new HttpPaymentApi(api, auth).confirmTestPayment(payment)).rejects.toMatchObject({
    code: 'UNKNOWN',
    details: { reason: 'PAYMENT_BACKEND_NOT_READY', status: 400 },
    message: 'UNKNOWN',
  });
});

it('classifies an unavailable session RPC before confirmation is attempted', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          message:
            'Could not find the function public.begin_payment(p_booking_id, p_gateway) in the schema cache',
        }),
        { status: 400 },
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  await expect(new HttpPaymentApi(api, auth).createPaymentSession('booking-a', 'TEST')).rejects.toMatchObject(
    {
      code: 'UNKNOWN',
      details: { reason: 'PAYMENT_BACKEND_NOT_READY' },
    },
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('bounds a stalled confirmation request without retrying it', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(
    (_url, options: RequestInit) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      }),
  );
  vi.stubGlobal('fetch', fetcher);
  const request = new HttpPaymentApi(api, auth).confirmTestPayment(payment);
  const assertion = expect(request).rejects.toMatchObject({
    code: 'NETWORK',
    details: { reason: 'REQUEST_TIMEOUT' },
  });
  await vi.advanceTimersByTimeAsync(20_000);
  await assertion;
  expect(fetcher).toHaveBeenCalledTimes(1);
});
