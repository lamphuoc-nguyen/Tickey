import { describe, expect, it } from 'vitest';
import { readAuthCallback } from './auth-callback';

describe('auth callback URL', () => {
  it('rejects the provider error even if session credentials are also present', () => {
    expect(() =>
      readAuthCallback(
        'exp://192.0.2.4:8081/--/auth/callback#error=access_denied&error_code=otp_expired&access_token=test&refresh_token=test',
        {},
      ),
    ).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED', details: { reason: 'AUTH_LINK_EXPIRED' } }),
    );
  });
  it('reads query codes and fragment sessions while keeping recovery distinct', () => {
    expect(readAuthCallback('eventcustomer://auth/callback?code=auth-code&type=recovery', {})).toMatchObject({
      code: 'auth-code',
      type: 'recovery',
    });
    expect(
      readAuthCallback(
        'exp://192.0.2.4:8081/--/auth/callback?type=signup#access_token=token&refresh_token=refresh',
        {},
      ),
    ).toMatchObject({ accessToken: 'token', refreshToken: 'refresh', type: 'email' });
  });
  it('does not treat an empty or incomplete callback as authentication success', () => {
    expect(() => readAuthCallback(null, { type: 'signup' })).toThrow();
    expect(() => readAuthCallback('eventcustomer://auth/callback#access_token=token', {})).toThrow();
    expect(() => readAuthCallback('eventcustomer://auth/callback?type=invite&token_hash=hash', {})).toThrow();
  });
});
