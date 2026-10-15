import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseAuthRepository } from './auth-repository';

describe('email confirmation contract', () => {
  it('forwards the requested app callback for both signup and resend', async () => {
    const signUp = vi.fn(async () => ({ data: { session: null }, error: null }));
    const resend = vi.fn(async () => ({ error: null }));
    const repo = new SupabaseAuthRepository({ auth: { signUp, resend } } as unknown as SupabaseClient);
    const callback = 'exp://192.0.2.4:8081/--/auth/callback?type=signup';
    await expect(repo.register('customer@example.test', 'password123', 'Khách hàng', callback)).resolves.toBe(
      false,
    );
    await repo.resendSignup('customer@example.test', callback);
    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: { data: { full_name: 'Khách hàng' }, emailRedirectTo: callback } }),
    );
    expect(resend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'customer@example.test',
      options: { emailRedirectTo: callback },
    });
  });
  it('preserves the no-redirect call signature for existing callers', async () => {
    const resend = vi.fn(async () => ({ error: null }));
    const repo = new SupabaseAuthRepository({ auth: { resend } } as unknown as SupabaseClient);
    await repo.resendSignup('customer@example.test');
    expect(resend).toHaveBeenCalledWith({ type: 'signup', email: 'customer@example.test' });
  });
  it('surfaces an expired server verification instead of treating it as successful confirmation', async () => {
    const verifyOtp = vi.fn(async () => ({
      error: { name: 'AuthApiError', code: 'otp_expired', status: 403 },
    }));
    const repo = new SupabaseAuthRepository({ auth: { verifyOtp } } as unknown as SupabaseClient);
    await expect(repo.acceptCallback({ tokenHash: 'expired-hash', type: 'signup' })).rejects.toMatchObject({
      details: { reason: 'AUTH_LINK_EXPIRED' },
    });
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'expired-hash', type: 'email' });
  });
  it('verifies the email code in the app without exchanging a desktop callback', async () => {
    const verifyOtp = vi.fn(async () => ({ error: null }));
    const exchangeCodeForSession = vi.fn();
    const repo = new SupabaseAuthRepository({ auth: { verifyOtp, exchangeCodeForSession } } as unknown as SupabaseClient);
    await repo.verifyOtp(' user@example.test ', ' 12345678 ', 'signup');
    expect(verifyOtp).toHaveBeenCalledWith({ email: 'user@example.test', token: '12345678', type: 'email' });
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    for (const token of ['', '12345', '12345678901', 'abcd1234'])
      await expect(repo.verifyOtp('user@example.test', token, 'signup')).rejects.toThrow();
    expect(verifyOtp).toHaveBeenCalledTimes(1);
  });
  it('does not sign in or auto-confirm when a manually entered code has expired', async () => {
    const verifyOtp = vi.fn(async () => ({ error: { name: 'AuthApiError', code: 'otp_expired', status: 403 } }));
    const repo = new SupabaseAuthRepository({ auth: { verifyOtp } } as unknown as SupabaseClient);
    await expect(repo.verifyOtp('user@example.test', '123456', 'signup')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED', details: { reason: 'AUTH_LINK_EXPIRED' },
    });
  });
});
