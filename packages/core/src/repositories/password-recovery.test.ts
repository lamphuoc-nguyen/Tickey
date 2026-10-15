import { createClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseAuthRepository } from './auth-repository';

function recoveryFixture() {
  const user = {
    id: 'recovery-user',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'customer@example.test',
    email_confirmed_at: '2026-10-15T00:00:00Z',
    created_at: '2026-10-15T00:00:00Z',
    app_metadata: { provider: 'email' },
    user_metadata: {},
  };
  const session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  };
  const failures = new Map<string, { status: number; code: string }>();
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const path = new URL(String(input)).pathname.replace('/auth/v1/', '');
    const method = init?.method ?? 'GET';
    calls.push({ path, method, body: init?.body ? JSON.parse(String(init.body)) : {} });
    if (path === 'logout') return new Response(null, { status: 204 });
    const failure = failures.get(path);
    return new Response(
      JSON.stringify(
        failure
          ? { code: failure.code, msg: failure.code }
          : path === 'recover'
            ? {}
            : path === 'user'
              ? { user }
              : session,
      ),
      {
        status: failure?.status ?? 200,
        headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
      },
    );
  });
  const client = createClient('https://auth.example.test', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  return { client, calls, failures, repository: new SupabaseAuthRepository(client) };
}

describe('password recovery via email OTP', () => {
  it('requests recovery, verifies a recovery OTP, and updates the password only after verification', async () => {
    const { repository, calls } = recoveryFixture();
    const onSession = vi.fn();
    const unsubscribe = repository.subscribe(onSession);
    const callback = 'eventcustomer://auth/callback?type=recovery';
    await repository.forgotPassword(' customer@example.test ', callback);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      path: 'recover',
      method: 'POST',
      body: { email: 'customer@example.test' },
    });
    await expect(repository.resetPassword('new-password123')).rejects.toMatchObject({
      details: { reason: 'AUTH_RECOVERY_REQUIRED' },
    });
    await repository.verifyOtp(' customer@example.test ', ' 12345678 ', 'recovery');
    expect(calls.find((call) => call.path === 'verify')?.body).toMatchObject({
      email: 'customer@example.test',
      token: '12345678',
      type: 'recovery',
    });
    expect((await repository.session())?.passwordRecovery).toBe(true);
    expect(onSession).toHaveBeenCalledWith(
      expect.objectContaining({ passwordRecovery: true }),
      'PASSWORD_RECOVERY',
    );
    await repository.resetPassword('new-password123');
    expect(calls.filter((call) => call.path === 'user' && call.method === 'PUT')).toMatchObject([
      { path: 'user', method: 'PUT', body: { password: 'new-password123' } },
    ]);
    expect((await repository.session())?.passwordRecovery).toBe(false);
    unsubscribe();
  });

  it('does not let an ordinary password login or reopening the app skip recovery verification', async () => {
    const { repository, client, calls } = recoveryFixture();
    await repository.login('customer@example.test', 'password123');
    await expect(repository.resetPassword('new-password123')).rejects.toMatchObject({
      details: { reason: 'AUTH_RECOVERY_REQUIRED' },
    });
    await repository.verifyOtp('customer@example.test', '123456', 'recovery');
    const reopened = new SupabaseAuthRepository(client);
    await expect(reopened.resetPassword('new-password123')).rejects.toMatchObject({
      details: { reason: 'AUTH_RECOVERY_REQUIRED' },
    });
    expect(calls.some((call) => call.path === 'user')).toBe(false);
  });

  it('keeps expired or incorrect OTPs from granting access to reset', async () => {
    const { repository, calls, failures } = recoveryFixture();
    failures.set('verify', { status: 403, code: 'otp_expired' });
    await expect(repository.verifyOtp('customer@example.test', '123456', 'recovery')).rejects.toMatchObject({
      details: { reason: 'AUTH_LINK_EXPIRED' },
    });
    await expect(repository.resetPassword('new-password123')).rejects.toMatchObject({
      details: { reason: 'AUTH_RECOVERY_REQUIRED' },
    });
    expect(calls.some((call) => call.path === 'user')).toBe(false);
  });

  it('does not accept a signup/email OTP as a recovery OTP', async () => {
    const { repository } = recoveryFixture();
    await repository.verifyOtp('customer@example.test', '123456', 'signup');
    await expect(repository.resetPassword('new-password123')).rejects.toMatchObject({
      details: { reason: 'AUTH_RECOVERY_REQUIRED' },
    });
  });

  it('clears recovery access after resend or logout and preserves real send errors', async () => {
    const { repository, failures } = recoveryFixture();
    await repository.verifyOtp('customer@example.test', '123456', 'recovery');
    await repository.forgotPassword('customer@example.test', 'eventcustomer://auth/callback?type=recovery');
    expect((await repository.session())?.passwordRecovery).toBe(false);
    failures.set('recover', { status: 429, code: 'over_email_send_rate_limit' });
    await expect(
      repository.forgotPassword('customer@example.test', 'eventcustomer://auth/callback?type=recovery'),
    ).rejects.toMatchObject({ details: { reason: 'AUTH_EMAIL_RATE_LIMIT' } });
    await repository.verifyOtp('customer@example.test', '123456', 'recovery');
    await repository.logout();
    await expect(repository.resetPassword('new-password123')).rejects.toMatchObject({
      details: { reason: 'AUTH_RECOVERY_REQUIRED' },
    });
  });

  it('preserves recovery access on retryable password rejection so the user can correct it', async () => {
    const { repository, failures } = recoveryFixture();
    await repository.verifyOtp('customer@example.test', '123456', 'recovery');
    failures.set('user', { status: 422, code: 'same_password' });
    await expect(repository.resetPassword('password123')).rejects.toMatchObject({
      details: { reason: 'AUTH_SAME_PASSWORD' },
    });
    expect((await repository.session())?.passwordRecovery).toBe(true);
    failures.delete('user');
    await expect(repository.resetPassword('different-password123')).resolves.toBeUndefined();
  });

  it('keeps valid recovery link callbacks compatible', async () => {
    const { repository } = recoveryFixture();
    await repository.acceptCallback({ tokenHash: 'test-token-hash', type: 'recovery' });
    expect((await repository.session())?.passwordRecovery).toBe(true);
    await expect(repository.resetPassword('new-password123')).resolves.toBeUndefined();
  });
});
