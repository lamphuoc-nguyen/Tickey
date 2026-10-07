import type { SupabaseClient } from '@supabase/supabase-js';
import { ApiError } from '../errors';
import { parseBooking, toItemJson, type Booking, type CreateBookingParams } from '../models/booking';

export interface BookingRepository {
  createBooking(params: CreateBookingParams): Promise<Booking>;
  getBooking(bookingId: string): Promise<Booking>;
  cancelBooking(bookingId: string): Promise<Booking>;
}

export class SupabaseBookingRepository implements BookingRepository {
  private readonly client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  async createBooking(p: CreateBookingParams): Promise<Booking> {
    const { data, error } = await this.client.rpc('create_booking', {
      p_session_id: p.sessionId,
      p_items: p.items.map(toItemJson),
      p_idempotency_key: p.idempotencyKey,
      ...(p.options ? { p_options: p.options } : {}),
    });
    if (error) throw ApiError.fromPostgrest(error);
    return parseBooking(data);
  }

  async getBooking(bookingId: string): Promise<Booking> {
    const { data, error } = await this.client.rpc('get_booking', { p_booking_id: bookingId });
    if (error) throw ApiError.fromPostgrest(error);
    return parseBooking(data);
  }

  async cancelBooking(bookingId: string): Promise<Booking> {
    const { data, error } = await this.client.rpc('cancel_booking', { p_booking_id: bookingId });
    if (error) throw ApiError.fromPostgrest(error);
    return parseBooking(data);
  }
}
