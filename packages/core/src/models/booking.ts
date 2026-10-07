import { z } from 'zod';

// MT §6, SRS 3.4: the nine Booking states.
export const BOOKING_STATUSES = [
  'PENDING',
  'PAYMENT_PENDING',
  'PAID',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

// Shape of public.booking_to_json() (returned by create_booking, get_booking, cancel_booking).
const bookingItemJson = z.object({
  ticket_type_id: z.string(),
  zone_id: z.string().nullable(),
  seat_id: z.string().nullable(),
  seat_code: z.string().nullable(),
  quantity: z.number(),
  unit_list_price: z.number(),
  unit_discount: z.number(),
  unit_price: z.number(),
});

export const bookingJson = z.object({
  id: z.string(),
  code: z.string(),
  status: z.enum(BOOKING_STATUSES),
  booking_type: z.string(),
  session_id: z.string(),
  item_count: z.number(),
  list_amount: z.number(),
  discount_amount: z.number(),
  total_amount: z.number(),
  currency: z.string(),
  lock_expires_at: z.string().nullable(),
  payment_deadline_at: z.string().nullable(),
  server_now: z.string(),
  items: z.array(bookingItemJson),
});

export interface BookingItem {
  ticketTypeId: string;
  zoneId: string | null;
  seatId: string | null;
  seatCode: string | null;
  quantity: number;
  unitListPrice: number;
  unitDiscount: number;
  unitPrice: number;
}

export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  bookingType: string;
  sessionId: string;
  itemCount: number;
  listAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  lockExpiresAt: string | null;
  paymentDeadlineAt: string | null;
  /** Server clock when the response was built: hold countdown = lockExpiresAt - serverNow (MT §21.3). */
  serverNow: string;
  items: BookingItem[];
}

export function parseBooking(data: unknown): Booking {
  const b = bookingJson.parse(data);
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    bookingType: b.booking_type,
    sessionId: b.session_id,
    itemCount: b.item_count,
    listAmount: b.list_amount,
    discountAmount: b.discount_amount,
    totalAmount: b.total_amount,
    currency: b.currency,
    lockExpiresAt: b.lock_expires_at,
    paymentDeadlineAt: b.payment_deadline_at,
    serverNow: b.server_now,
    items: b.items.map((i) => ({
      ticketTypeId: i.ticket_type_id,
      zoneId: i.zone_id,
      seatId: i.seat_id,
      seatCode: i.seat_code,
      quantity: i.quantity,
      unitListPrice: i.unit_list_price,
      unitDiscount: i.unit_discount,
      unitPrice: i.unit_price,
    })),
  };
}

/** Milliseconds left on the hold, measured against the server clock, never the device clock. */
export function holdRemainingMs(booking: Pick<Booking, 'lockExpiresAt' | 'serverNow'>): number {
  if (!booking.lockExpiresAt) return 0;
  return Math.max(0, Date.parse(booking.lockExpiresAt) - Date.parse(booking.serverNow));
}

/** One line of create_booking.p_items: a seat, or a quantity in a standing zone. Never a price. */
export type BookingItemInput =
  { ticketTypeId: string; seatId: string } | { ticketTypeId: string; quantity: number; zoneId?: string };

export interface CreateBookingParams {
  sessionId: string;
  items: BookingItemInput[];
  /** One UUID per user tap on "Đặt vé"; reuse it on retry (MT §21.3). */
  idempotencyKey: string;
  options?: { booking_type?: 'POS' };
}

export function toItemJson(item: BookingItemInput): Record<string, unknown> {
  if ('seatId' in item) return { ticket_type_id: item.ticketTypeId, seat_id: item.seatId };
  return {
    ticket_type_id: item.ticketTypeId,
    quantity: item.quantity,
    ...(item.zoneId ? { zone_id: item.zoneId } : {}),
  };
}
