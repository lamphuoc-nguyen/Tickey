import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpClient } from './http-client';
import { ApiError, SeatConflictError } from '../errors';
import { HttpPaymentApi } from './payment-api';

const auth = {
  auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'test-jwt' } }, error: null })) },
} as unknown as SupabaseClient;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('REST boundary', () => {
  it('ends an unresponsive request with a retryable timeout instead of loading forever', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
          }),
      ),
    );
    const pending = new HttpClient('http://api.test', auth, 1000).request('/api/events', z.unknown());
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'NETWORK',
      details: { reason: 'REQUEST_TIMEOUT' },
    });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });
  it('preserves caller cancellation without converting it to a connectivity error', async () => {
    const abort = new AbortController();
    abort.abort(new Error('route changed'));
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    await expect(
      new HttpClient('http://api.test', auth).request('/api/events', z.unknown(), { signal: abort.signal }),
    ).rejects.toThrow('route changed');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each(['OTP_REQUIRED', 'MFA_REQUIRED', 'DEVICE_REVOKED'])(
    'preserves %s and business details on HTTP 403',
    async (code) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                message: code,
                details: '{"reason":"recent verification required"}',
              }),
              { status: 403 },
            ),
        ),
      );
      await expect(
        new HttpClient('http://api.test', auth).request('/api/refunds/id/bank-info', z.unknown()),
      ).rejects.toMatchObject({ code, details: { reason: 'recent verification required' } });
    },
  );
  it('keeps empty results separate from permission and missing-resource errors', async () => {
    const client = new HttpClient('http://api.test', auth);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('[]', { status: 200 })),
    );
    await expect(client.request('/api/tickets', z.array(z.unknown()))).resolves.toEqual([]);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"message":"Forbidden"}', { status: 403 })),
    );
    await expect(client.request('/api/tickets', z.array(z.unknown()))).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );
    await expect(client.request('/api/tickets/missing', z.unknown())).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
  it('forwards JWT and camelCase request fields without server credentials', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: 'row' }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await new HttpClient('http://api.test/', auth).request('/api/me', z.object({ id: z.string() }), {
      method: 'PUT',
      body: { fullName: 'Tên tiếng Việt' },
      authenticated: true,
    });
    expect(fetcher.mock.calls[0]).toEqual([
      'http://api.test/api/me',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-jwt' }),
        body: '{"fullName":"Tên tiếng Việt"}',
      }),
    ]);
  });
  it('branches on message/details even when HTTP status is generic', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'SEAT_CONFLICT', details: '{"seat_ids":["A5"]}' }), {
            status: 400,
          }),
      ),
    );
    await expect(
      new HttpClient('http://api.test', auth).request('/api/bookings', z.unknown()),
    ).rejects.toEqual(new SeatConflictError(['A5'], { seat_ids: ['A5'] }));
  });
  it('maps the API rate limit (429) to RATE_LIMITED with the retry delay', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ message: 'RATE_LIMITED', details: '{"retry_after_seconds":60}' }), {
            status: 429,
          }),
      ),
    );
    await expect(
      new HttpClient('http://api.test', auth).request('/api/auth/login', z.unknown()),
    ).rejects.toEqual(new ApiError('RATE_LIMITED', { retry_after_seconds: 60 }));
  });
  it('keeps an unanswered live request as NETWORK, never returns fixtures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline');
      }),
    );
    await expect(
      new HttpClient('http://api.test', auth).request('/api/events', z.array(z.unknown())),
    ).rejects.toEqual(new ApiError('NETWORK'));
  });
  it('rejects malformed success data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"id":5}', { status: 200 })),
    );
    await expect(
      new HttpClient('http://api.test', auth).request('/api/me', z.object({ id: z.string() })),
    ).rejects.toMatchObject({ code: 'UNKNOWN', details: { reason: 'INVALID_RESPONSE' } });
  });
  it('parses the distinct camelCase PaymentSession and rejects mismatched booking', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              bookingId: 'other',
              paymentUrl: 'https://gateway.test',
              expiresAt: '2026-10-14T00:00:00+00:00',
            }),
            { status: 200 },
          ),
      ),
    );
    await expect(
      new HttpPaymentApi('http://api.test', auth).createPaymentSession('mine', 'gateway'),
    ).rejects.toMatchObject({ code: 'UNKNOWN', details: { reason: 'BOOKING_MISMATCH' } });
  });
});
