import { describe, it, expect } from 'vitest';
import { authError } from './auth-error';
describe('auth failure cause', () => {
  it('keeps unanswered requests as network failures', () => {
    expect(authError({ name: 'AuthRetryableFetchError' }).code).toBe('NETWORK');
    expect(authError({ name: 'AuthRetryableFetchError', status: 0 }).code).toBe('NETWORK');
  });
  it.each(['AuthApiError', 'AuthRetryableFetchError'])(
    'distinguishes an HTTP server error from a network failure for %s',
    (name) => {
      expect(authError({ name, status: 503 })).toMatchObject({
        code: 'UNKNOWN',
        details: { reason: 'AUTH_SERVICE_ERROR', status: 503 },
      });
    },
  );
  it.each([
    'Error sending confirmation email',
    'Error sending recovery email',
    'Error sending confirmation mail',
  ])('recognizes the SDK email failure without requiring a server code: %s', (message) => {
    expect(authError({ name: 'AuthRetryableFetchError', status: 500, message })).toMatchObject({
      code: 'UNKNOWN',
      details: { reason: 'AUTH_EMAIL_DELIVERY_FAILED', status: 500 },
    });
  });
  it('does not expose raw SMTP details or assume every server failure is an email failure', () => {
    const smtpMessage = 'Error sending confirmation email: 535 rejected credential=private-value';
    const mapped = authError({ name: 'AuthRetryableFetchError', status: 500, message: smtpMessage });
    expect(mapped.details.reason).toBe('AUTH_EMAIL_DELIVERY_FAILED');
    expect(JSON.stringify(mapped)).not.toContain('private-value');
    expect(mapped.message).not.toContain('private-value');
    expect(
      authError({
        name: 'AuthRetryableFetchError',
        status: 500,
        message: 'Database error saving new user',
      }).details.reason,
    ).toBe('AUTH_SERVICE_ERROR');
  });
  it('distinguishes the default SMTP recipient restriction from a login failure', () => {
    expect(
      authError({ name: 'AuthApiError', status: 403, code: 'email_address_not_authorized' }),
    ).toMatchObject({
      code: 'FORBIDDEN',
      details: { reason: 'AUTH_EMAIL_NOT_AUTHORIZED' },
    });
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
