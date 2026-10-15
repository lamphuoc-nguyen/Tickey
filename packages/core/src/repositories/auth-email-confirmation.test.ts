import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseAuthRepository } from './auth-repository';

const confirmedAt = '2026-10-15T00:00:00Z';
function authFixture(emailConfirmed: boolean) {
  const user = {
    id: 'user-test',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'customer@example.test',
    created_at: confirmedAt,
    email_confirmed_at: emailConfirmed ? confirmedAt : undefined,
    // User-editable metadata must never count as confirmation.
    user_metadata: { email_verified: true },
    app_metadata: { provider: 'email' },
  };
  const session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
  const fetch = vi.fn<typeof globalThis.fetch>(async (input) =>
    String(input).includes('/logout')
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(session), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
  );
  const client = createClient('https://auth.example.test', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  return { client, session, repository: new SupabaseAuthRepository(client) };
}

describe('email confirmation before app access', () => {
  it('rejects an unconfirmed login and clears its SDK session even if the server issued tokens', async () => {
    const { client, repository } = authFixture(false);
    const onSession = vi.fn();
    const unsubscribe = repository.subscribe(onSession);
    try {
      await expect(repository.login('customer@example.test', 'password123')).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
        details: { reason: 'EMAIL_NOT_CONFIRMED' },
      });
      expect((await client.auth.getSession()).data.session).toBeNull();
      expect(await repository.session()).toBeNull();
      expect(onSession).toHaveBeenCalled();
      expect(onSession.mock.calls.every(([session]) => session === null)).toBe(true);
    } finally {
      unsubscribe();
    }
  });

  it('keeps signup on email verification when an unconfirmed session is returned', async () => {
    const { client, repository } = authFixture(false);
    await expect(
      repository.register(
        'customer@example.test',
        'password123',
        'Khách hàng',
        'eventcustomer://auth/callback?type=signup',
      ),
    ).resolves.toBe(false);
    expect((await client.auth.getSession()).data.session).toBeNull();
  });

  it('allows a confirmed account to sign in and restore its session', async () => {
    const { repository } = authFixture(true);
    await expect(repository.login('customer@example.test', 'password123')).resolves.toBeUndefined();
    await expect(repository.session()).resolves.toMatchObject({
      userId: 'user-test',
      email: 'customer@example.test',
    });
  });

  it.each([undefined, null, ''])(
    'does not restore an unconfirmed stored session (%s)',
    async (emailConfirmedAt) => {
      const { session } = authFixture(false);
      const getSession = vi.fn(async () => ({
        data: { session: { ...session, user: { ...session.user, email_confirmed_at: emailConfirmedAt } } },
        error: null,
      }));
      const getUser = vi.fn();
      const repository = new SupabaseAuthRepository({
        auth: { getSession, getUser },
      } as unknown as SupabaseClient);
      await expect(repository.session()).resolves.toBeNull();
      expect(getUser).not.toHaveBeenCalled();
    },
  );

  it('preserves Supabase rejection of an unconfirmed password login', async () => {
    const client = createClient('https://auth.example.test', 'public-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async () =>
          new Response(
            JSON.stringify({
              code: 'email_not_confirmed',
              msg: 'Email not confirmed',
            }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'X-Supabase-Api-Version': '2024-01-01',
              },
            },
          ),
      },
    });
    const repository = new SupabaseAuthRepository(client);
    await expect(repository.login('customer@example.test', 'password123')).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      details: { reason: 'EMAIL_NOT_CONFIRMED' },
    });
    expect((await client.auth.getSession()).data.session).toBeNull();
  });
});
