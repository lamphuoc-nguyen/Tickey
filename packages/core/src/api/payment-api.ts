import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError, type PostgrestLikeError } from '../errors';

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

export class HttpPaymentApi implements PaymentApi {
  private readonly apiUrl: string;
  private readonly client: SupabaseClient;

  constructor(apiUrl: string | undefined, client: SupabaseClient) {
    if (!apiUrl) throw new Error('Missing API URL (EXPO_PUBLIC_API_URL / VITE_API_URL).');
    this.apiUrl = apiUrl;
    this.client = client;
  }

  async createPaymentSession(bookingId: string, gateway: string): Promise<PaymentSession> {
    const { data } = await this.client.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError('UNAUTHENTICATED');

    let res: Response;
    try {
      res = await fetch(`${this.apiUrl}/payments/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookingId, gateway }),
      });
    } catch (e) {
      throw new ApiError('NETWORK', {}, e instanceof Error ? e.message : String(e));
    }
    if (res.status === 401) throw new ApiError('UNAUTHENTICATED');
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      // The API forwards the RPC error as { message: CODE, details: "<json>" }.
      if (body && typeof body === 'object' && 'message' in body) {
        throw ApiError.fromPostgrest(body as PostgrestLikeError);
      }
      throw new ApiError('UNKNOWN', { status: res.status });
    }
    return body as PaymentSession;
  }
}
