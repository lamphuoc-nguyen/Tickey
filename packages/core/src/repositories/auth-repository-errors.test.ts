import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseAuthRepository } from './auth-repository';

describe('signup errors through the installed Supabase SDK', () => {
  it.each([
    ['Error sending confirmation email', 'AUTH_EMAIL_DELIVERY_FAILED'],
    ['Database error saving new user', 'AUTH_SERVICE_ERROR'],
  ])('preserves the cause of a real HTTP 500 response: %s', async (msg, reason) => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(
          JSON.stringify({
            code: 'unexpected_failure',
            msg,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } },
        ),
    );
    const client = createClient('https://auth.example.test', 'public-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch },
    });
    const repository = new SupabaseAuthRepository(client);
    await expect(
      repository.register(
        'customer@example.test',
        'password123',
        'Khách hàng',
        'eventcustomer://auth/callback?type=signup',
      ),
    ).rejects.toMatchObject({
      code: 'UNKNOWN',
      details: { reason, status: 500 },
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]?.[0]).toContain('/auth/v1/signup');
  });
});
