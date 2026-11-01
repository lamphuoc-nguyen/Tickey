import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { ApiError } from '../errors';

// .NET API contract (MT §20.9, §24): POST /payments/sessions with the user's JWT.
// The API calls begin_payment on behalf of the user and returns the gateway URL.
export interface PaymentSession {
  bookingId: string;
  paymentUrl: string;
  expiresAt: string;
}

export interface PaymentApi {
  createPaymentSession(bookingId: string, gateway: string): Promise<PaymentSession>;
}

/** The API's RPC middleware keeps message/details, but older deployments omit the PostgREST code. */
function paymentFailure(status: number, body: unknown): ApiError {
  const parsed = z
    .object({
      code: z.string().optional(),
      message: z.string().optional(),
      details: z.string().nullish(),
    })
    .safeParse(body);
  if (parsed.success) {
    const { code, message, details } = parsed.data;
    if (
      code === 'PGRST202' ||
      /Could not find the function public\.(?:get_payment_by_order_ref|begin_payment)\b/i.test(message ?? '')
    )
      return new ApiError('UNKNOWN', { reason: 'PAYMENT_BACKEND_NOT_READY', status });
    if (message) return ApiError.fromPostgrest({ message, details });
  }
  return new ApiError(status === 401 ? 'UNAUTHENTICATED' : status === 403 ? 'FORBIDDEN' : 'UNKNOWN', {
    status,
  });
}

export class HttpPaymentApi implements PaymentApi {
  private readonly apiUrl: string;
  private readonly client: SupabaseClient;
  private readonly timeoutMs: number;

  constructor(apiUrl: string | undefined, client: SupabaseClient, timeoutMs = 20_000) {
    if (!apiUrl) throw new Error('Missing API URL (EXPO_PUBLIC_API_URL / VITE_API_URL).');
    this.apiUrl = apiUrl.replace(/\/+$/, '');
    this.client = client;
    this.timeoutMs = timeoutMs;
  }

  /** Submit the existing signed TEST form. Submission is not proof of payment; always reload Booking. */
  async confirmTestPayment(session: PaymentSession): Promise<void> {
    let checkout: URL;
    try {
      checkout = new URL(session.paymentUrl);
      const api = new URL(this.apiUrl);
      const returnValue = checkout.searchParams.get('return');
      const back = new URL(returnValue ?? '');
      if (
        !['http:', 'https:'].includes(api.protocol) ||
        checkout.origin !== api.origin ||
        checkout.username ||
        checkout.password ||
        !/^\/payments\/test\/[A-Za-z0-9_-]+$/.test(checkout.pathname) ||
        back.origin !== api.origin ||
        back.pathname !== '/payments/return' ||
        back.searchParams.get('booking_id') !== session.bookingId ||
        !/^\d+$/.test(checkout.searchParams.get('amount') ?? '') ||
        !checkout.searchParams.get('sig') ||
        ['amount', 'return', 'sig'].some((key) => checkout.searchParams.getAll(key).length !== 1)
      )
        throw new Error('Invalid signed test checkout');
    } catch {
      throw new ApiError('UNKNOWN', { reason: 'INVALID_TEST_PAYMENT_URL' });
    }
    const { data } = await this.client.auth.getSession();
    if (!data.session?.access_token) throw new ApiError('UNAUTHENTICATED');
    const body = new URLSearchParams({
      amount: checkout.searchParams.get('amount')!,
      return: checkout.searchParams.get('return')!,
      sig: checkout.searchParams.get('sig')!,
      result: 'success',
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    let failure: unknown;
    try {
      response = await fetch(`${checkout.origin}${checkout.pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: controller.signal,
      });
      if (!response.ok && response.status !== 302 && response.status !== 303)
        failure = await response.json().catch((error: unknown) => {
          if (controller.signal.aborted) throw error;
          return null;
        });
    } catch {
      // Native fetch can also fail while following the server's app-scheme redirect after commit.
      throw new ApiError('NETWORK', controller.signal.aborted ? { reason: 'REQUEST_TIMEOUT' } : {});
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok || response.status === 302 || response.status === 303) return;
    throw paymentFailure(response.status, failure);
  }

  async createPaymentSession(bookingId: string, gateway: string): Promise<PaymentSession> {
    const { data } = await this.client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError('UNAUTHENTICATED');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    let body: unknown;
    try {
      res = await fetch(`${this.apiUrl}/payments/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId, gateway }),
        signal: controller.signal,
      });
      body = await res.json().catch((error: unknown) => {
        if (controller.signal.aborted) throw error;
        return null;
      });
    } catch (e) {
      throw new ApiError(
        'NETWORK',
        controller.signal.aborted ? { reason: 'REQUEST_TIMEOUT' } : {},
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      clearTimeout(timeout);
    }
    if (res.status === 401) throw new ApiError('UNAUTHENTICATED');
    if (!res.ok) {
      throw paymentFailure(res.status, body);
    }
    const parsed = z
      .object({
        bookingId: z.string(),
        paymentUrl: z.url(),
        expiresAt: z.string().datetime({ offset: true }),
      })
      .safeParse(body);
    if (!parsed.success) throw new ApiError('UNKNOWN', { reason: 'INVALID_PAYMENT_RESPONSE' });
    if (parsed.data.bookingId !== bookingId) throw new ApiError('UNKNOWN', { reason: 'BOOKING_MISMATCH' });
    if (!/^https?:\/\//.test(parsed.data.paymentUrl))
      throw new ApiError('UNKNOWN', { reason: 'INVALID_PAYMENT_URL' });
    return parsed.data;
  }
}
