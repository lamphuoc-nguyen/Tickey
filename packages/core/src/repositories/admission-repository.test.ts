import { afterEach, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpClient } from '../api/http-client';
import { admissionSchema } from '../models/customer';
import { HttpCustomerRepository } from './customer-repository';

const id = '11111111-1111-4111-8111-111111111111';
const raw = { booking_id: id, status: 'CONFIRMED', qr: 'server-credential', total: 5, used: 2, remaining: 3 };
const auth = {
  auth: { getSession: async () => ({ data: { session: { access_token: 'test-jwt' } } }) },
} as unknown as SupabaseClient;
afterEach(() => vi.unstubAllGlobals());

it('reads a booking admission with JWT and preserves the server-issued code and counts', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(raw), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  const data = await new HttpCustomerRepository(new HttpClient('https://api.test', auth)).admission(id);
  expect(data).toMatchObject({ bookingId: id, qr: raw.qr, total: 5, used: 2, remaining: 3 });
  expect(fetcher).toHaveBeenCalledWith(
    `https://api.test/api/bookings/${id}/admission`,
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-jwt' }) }),
  );
});

it('rejects a response belonging to another booking instead of displaying its QR', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response(JSON.stringify({ ...raw, booking_id: '22222222-2222-4222-8222-222222222222' }), {
          status: 200,
        }),
    ),
  );
  await expect(
    new HttpCustomerRepository(new HttpClient('https://api.test', auth)).admission(id),
  ).rejects.toMatchObject({ code: 'UNKNOWN', details: { reason: 'INVALID_RESPONSE' } });
});

it('rejects impossible counters while accepting NO_SHOW entries not included in used/remaining', () => {
  expect(admissionSchema.safeParse({ ...raw, used: 4, remaining: 3 }).success).toBe(false);
  expect(admissionSchema.safeParse({ ...raw, used: 1, remaining: 1 }).success).toBe(true);
});
