import { ApiError, type SupabaseAuthRepository } from '@event/core';

export type AuthCallbackRouteParams = {
  code?: string;
  token_hash?: string;
  type?: string;
  error?: string;
  error_code?: string;
};
export function readAuthCallback(link: string | null, route: AuthCallbackRouteParams) {
  let query = new URLSearchParams();
  let hash = new URLSearchParams();
  if (link) {
    try {
      const url = new URL(link);
      query = url.searchParams;
      hash = new URLSearchParams(url.hash.slice(1));
    } catch {
      throw new ApiError('VALIDATION_FAILED', { reason: 'INVALID_AUTH_CALLBACK' });
    }
  }
  const read = (key: string) => hash.get(key) ?? query.get(key);
  const code = read('error_code') ?? route.error_code;
  if (code || read('error') || route.error) {
    throw new ApiError('VALIDATION_FAILED', {
      reason: code === 'otp_expired' ? 'AUTH_LINK_EXPIRED' : 'AUTH_CALLBACK_FAILED',
    });
  }
  const type = read('type') ?? route.type;
  if (type && !['signup', 'email', 'recovery'].includes(type))
    throw new ApiError('VALIDATION_FAILED', { reason: 'INVALID_AUTH_CALLBACK' });
  const callback: Parameters<SupabaseAuthRepository['acceptCallback']>[0] = {
    code: read('code') ?? route.code,
    tokenHash: read('token_hash') ?? route.token_hash,
    accessToken: read('access_token') ?? undefined,
    refreshToken: read('refresh_token') ?? undefined,
    type: type === 'recovery' ? 'recovery' : 'email',
  };
  if (!callback.code && !callback.tokenHash && !(callback.accessToken && callback.refreshToken))
    throw new ApiError('VALIDATION_FAILED', { reason: 'INVALID_AUTH_CALLBACK' });
  return callback;
}
