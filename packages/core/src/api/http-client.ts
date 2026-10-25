import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../errors';
import { authError } from './auth-error';

const errorBody = z.object({ message: z.string(), details: z.string().nullish() });

/** .NET forwards the caller's JWT to RLS/RPC; the client never uses a server key. */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly auth: SupabaseClient;
  private readonly timeoutMs: number;
  constructor(apiUrl: string | undefined, auth: SupabaseClient, timeoutMs = 20_000) {
    this.auth = auth;
    this.timeoutMs = timeoutMs;
    if (!apiUrl) throw new Error('Thiếu cấu hình API URL (VITE_API_URL hoặc EXPO_PUBLIC_API_URL).');
    this.baseUrl = z.url().parse(apiUrl).replace(/\/$/, '');
  }

  async request<T>(
    path: string,
    schema: z.ZodType<T>,
    options: {
      method?: string;
      body?: unknown;
      form?: FormData;
      authenticated?: boolean;
      signal?: AbortSignal;
    } = {},
  ): Promise<T> {
    const { data, error } = await this.auth.auth.getSession();
    if (error && options.authenticated) throw authError(error);
    const token = error ? undefined : data.session?.access_token;
    if (options.authenticated && !token) throw new ApiError('UNAUTHENTICATED');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    if (options.signal?.aborted) throw options.signal.reason ?? new Error('Request cancelled');
    options.signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(cancel, this.timeoutMs);
    let response: Response;
    let body: unknown;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          ...(options.form ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
        signal: controller.signal,
      });
      body =
        response.status === 204
          ? null
          : await response.json().catch((error: unknown) => {
              if (controller.signal.aborted) throw error;
              return null;
            });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError('NETWORK', controller.signal.aborted ? { reason: 'REQUEST_TIMEOUT' } : {});
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', cancel);
    }
    if (!response.ok) {
      // The API uses 403 for OTP_REQUIRED/MFA_REQUIRED as well as FORBIDDEN.
      // Preserve the RPC code and details before applying generic HTTP fallbacks.
      const parsed = errorBody.safeParse(body);
      if (parsed.success) {
        const failure = ApiError.fromPostgrest(parsed.data);
        if (failure.code !== 'UNKNOWN') throw failure;
      }
      if (response.status === 401) throw new ApiError('UNAUTHENTICATED');
      if (response.status === 403) throw new ApiError('FORBIDDEN');
      if (parsed.success) throw ApiError.fromPostgrest(parsed.data);
      throw new ApiError(response.status === 404 ? 'NOT_FOUND' : 'UNKNOWN', {
        status: response.status,
      });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new ApiError('UNKNOWN', { reason: 'INVALID_RESPONSE', path });
    return parsed.data;
  }
}

export function pageQuery(input: { limit?: number; offset?: number }): URLSearchParams {
  return new URLSearchParams({ limit: String(input.limit ?? 20), offset: String(input.offset ?? 0) });
}
