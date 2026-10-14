import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpClient } from './http-client';
import { ApiError, SeatConflictError } from '../errors';
import { HttpPaymentApi } from './payment-api';

const auth = {
  auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 'test-jwt' } }, error: null })) },
} as unknown as SupabaseClient;
afterEach(() => vi.unstubAllGlobals());
describe('REST boundary', () => {
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
