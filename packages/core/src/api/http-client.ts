import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../errors';
import { authError } from './auth-error';

const errorBody = z.object({ message: z.string(), details: z.string().nullish() });

/** .NET forwards the caller's JWT to RLS/RPC; the client never uses a server key. */
export class HttpClient {
  private readonly baseUrl: string;
  private readonly auth: SupabaseClient;
  constructor(apiUrl: string | undefined, auth: SupabaseClient) {
    this.auth = auth;
    if (!apiUrl) throw new Error('Thiếu EXPO_PUBLIC_API_URL. Xem apps/customer/.env.example.');
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
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers: {
          ...(options.form ? {} : { 'Content-Type': 'application/json' }),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
        signal: options.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError('NETWORK');
    }
    const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new ApiError('UNAUTHENTICATED');
      if (response.status === 403) throw new ApiError('FORBIDDEN');
      const parsed = errorBody.safeParse(body);
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
