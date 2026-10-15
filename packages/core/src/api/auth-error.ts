import { ApiError } from '../errors';
export function authError(error: {
  name: string;
  status?: number;
  code?: string;
  message?: string;
}): ApiError {
  if (error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit')
    return new ApiError('VALIDATION_FAILED', { reason: 'AUTH_EMAIL_RATE_LIMIT' });
  if (error.code === 'email_address_not_authorized')
    return new ApiError('FORBIDDEN', { reason: 'AUTH_EMAIL_NOT_AUTHORIZED' });
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
  if (error.status !== undefined && error.status >= 500) {
    // The installed Auth SDK wraps HTTP 5xx as AuthRetryableFetchError and drops the
    // server code. Recognize only GoTrue's email failure prefix; never expose SMTP details.
    const emailFailed =
      /^Error sending (?:(?:confirmation|recovery|magic link|reauthentication|email change) )?(?:email|mail)(?::|$)/i.test(
        error.message ?? '',
      );
    return new ApiError('UNKNOWN', {
      reason: emailFailed ? 'AUTH_EMAIL_DELIVERY_FAILED' : 'AUTH_SERVICE_ERROR',
      status: error.status,
    });
  }
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return new ApiError('NETWORK');
  return new ApiError(
    'UNAUTHENTICATED',
    error.code === 'invalid_credentials'
      ? { reason: 'INVALID_CREDENTIALS' }
      : error.code === 'email_not_confirmed'
        ? { reason: 'EMAIL_NOT_CONFIRMED' }
        : {},
  );
}
