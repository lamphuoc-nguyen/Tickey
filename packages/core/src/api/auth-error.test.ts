import { describe, it, expect } from 'vitest';
import { authError } from './auth-error';
describe('auth failure cause', () => {
  it('does not ask the user to log in when session loading failed on the network', () => {
    expect(authError({ name: 'AuthRetryableFetchError' }).code).toBe('NETWORK');
    expect(authError({ name: 'AuthApiError', status: 503 }).code).toBe('NETWORK');
  });
  it('keeps invalid credentials distinct from an unavailable connection', () => {
    expect(authError({ name: 'AuthApiError', status: 400, code: 'invalid_credentials' })).toMatchObject({
      code: 'UNAUTHENTICATED',
      details: { reason: 'INVALID_CREDENTIALS' },
    });
  });
  it('distinguishes unconfirmed email and rate limiting from invalid login credentials', () => {
    expect(authError({ name: 'AuthApiError', code: 'email_not_confirmed', status: 400 }).details.reason).toBe(
      'EMAIL_NOT_CONFIRMED',
    );
    expect(
      authError({ name: 'AuthApiError', code: 'over_email_send_rate_limit', status: 429 }).details.reason,
    ).toBe('AUTH_EMAIL_RATE_LIMIT');
  });
  it('keeps rejected signup input as validation instead of asking for another login', () => {
    expect(authError({ name: 'AuthApiError', code: 'weak_password', status: 422 }).code).toBe(
      'VALIDATION_FAILED',
    );
  });
});
