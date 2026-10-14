import { ApiError } from '../errors';
export function authError(error: { name: string; status?: number; code?: string }): ApiError {
  if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit')
    return new ApiError('VALIDATION_FAILED', { reason: 'AUTH_EMAIL_RATE_LIMIT' });
  if (
    error.code &&
    [
      'weak_password',
      'validation_failed',
      'email_address_invalid',
      'email_exists',
      'user_already_exists',
    ].includes(error.code)
  )
    return new ApiError('VALIDATION_FAILED');
  if (error.code === 'otp_expired') return new ApiError('VALIDATION_FAILED', { reason: 'AUTH_LINK_EXPIRED' });
  if (
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    (error.status !== undefined && error.status >= 500)
  )
    return new ApiError('NETWORK');
  return new ApiError(
    'UNAUTHENTICATED',
    error.code === 'invalid_credentials'
      ? { reason: 'INVALID_CREDENTIALS' }
      : error.code === 'email_not_confirmed'
        ? { reason: 'EMAIL_NOT_CONFIRMED' }
        : {},
  );
}
