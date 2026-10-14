import { z } from 'zod';
import { BOOKING_STATUSES } from './booking';
import { mapDatabaseJson } from './database-mapper';
import { venueSchema } from './catalog';

const nullable = z.string().nullable();
export const profileSchema = z
  .object({
    id: z.string(),
    full_name: nullable,
    phone: nullable,
    avatar_url: nullable,
    locale: z.string(),
    email: nullable,
    created_at: z.string(),
  })
  .transform(mapDatabaseJson);
export const orderSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    status: z.enum(BOOKING_STATUSES),
    booking_type: z.string(),
    session_id: z.string(),
    item_count: z.number(),
    total_amount: z.number(),
    currency: z.string(),
    created_at: z.string(),
    session: z
      .object({
        id: z.string(),
        title: nullable,
        starts_at: z.string(),
        event: z.object({ id: z.string(), title: z.string(), cover_image_url: nullable }).nullable(),
      })
      .nullable(),
  })
  .transform(mapDatabaseJson);
const credentialJson = z.object({
  kid: z.string().min(1),
  payload: z.string().min(1),
  signature: z.string().min(1),
});
const credentialRelation = z
  .union([credentialJson, z.array(credentialJson).max(1)])
  .nullable()
  .transform((value) => (Array.isArray(value) ? (value[0] ?? null) : value));
export const ticketSchema = z
  .object({
    id: z.string(),
    booking_id: z.string(),
    session_id: z.string(),
    ticket_type_id: z.string(),
    zone_id: nullable,
    seat_id: nullable,
    holder_name: nullable,
    holder_email: nullable,
    holder_phone: nullable,
    status: z.enum(['ISSUED', 'USED', 'NO_SHOW', 'VOID', 'REFUND_PENDING', 'REFUNDED']),
    used_at: nullable,
    issued_at: nullable,
    credential: credentialRelation,
    seat: z.object({ seat_code: z.string() }).nullable(),
    ticket_type: z.object({ name: z.string(), kind: z.string() }).nullable(),
    session: z
      .object({
        id: z.string(),
        title: nullable,
        starts_at: z.string(),
        ends_at: z.string(),
        doors_open_at: z.string(),
        status: z.string(),
        event: z.object({ id: z.string(), title: z.string(), cover_image_url: nullable }).nullable(),
        venue: venueSchema.nullable(),
      })
      .nullable(),
  })
  .transform(mapDatabaseJson);
export const notificationSchema = z
  .object({
    id: z.string(),
    channel: z.string(),
    template: z.string(),
    title: nullable,
    body: nullable,
    data: z.record(z.string(), z.unknown()),
    status: z.string(),
    created_at: z.string(),
    read_at: nullable,
  })
  .transform(mapDatabaseJson);
export const refundSchema = z
  .object({
    id: z.string(),
    booking_id: z.string(),
    amount: z.number(),
    reason: z.string(),
    source_type: z.string(),
    status: z.enum([
      'REQUESTED',
      'PROCESSING',
      'SUCCEEDED',
      'FAILED',
      'AWAITING_BANK_INFO',
      'MANUAL_TRANSFER',
    ]),
    created_at: z.string(),
    updated_at: z.string(),
    succeeded_at: nullable,
  })
  .transform(mapDatabaseJson);
export const reportSchema = z
  .object({
    id: z.string(),
    session_id: z.string(),
    ticket_id: z.string(),
    category: z.string(),
    description: z.string(),
    status: z.string(),
    dispute_case_id: nullable,
    created_at: z.string(),
    updated_at: z.string(),
  })
  .transform(mapDatabaseJson);
export const supportSchema = z
  .object({
    id: z.string(),
    booking_id: nullable,
    category: z.string(),
    subject: z.string(),
    status: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    messages: z.array(
      z.object({
        id: z.string(),
        author_id: z.string(),
        author_side: z.string(),
        body: z.string(),
        created_at: z.string(),
      }),
    ),
  })
  .transform(mapDatabaseJson);
export const preferencesSchema = z
  .object({
    push_enabled: z.boolean(),
    email_enabled: z.boolean(),
    reminder_24h: z.boolean(),
    reminder_2h: z.boolean(),
  })
  .transform(mapDatabaseJson);
export const reportInputSchema = z.object({
  ticketId: z.uuid(),
  category: z.enum(['NOT_AS_DESCRIBED', 'EVENT_NOT_HELD', 'ENTRY_DENIED', 'SAFETY', 'SEAT_ISSUE', 'OTHER']),
  description: z.string().trim().min(10),
  attachmentPaths: z.array(z.string()).default([]),
});
export const supportInputSchema = z.object({
  category: z.enum(['PAYMENT', 'TICKET', 'REFUND', 'ACCOUNT', 'APP_BUG', 'OTHER']),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  bookingId: z.uuid().nullable(),
});
export const bankInputSchema = z.object({
  bankCode: z.string().trim().min(1),
  accountNumber: z.string().regex(/^\d{6,20}$/),
  accountHolder: z.string().trim().min(1),
});
export type Profile = z.infer<typeof profileSchema>;
export type Order = z.infer<typeof orderSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type Refund = z.infer<typeof refundSchema>;
export type NotificationPreferences = z.infer<typeof preferencesSchema>;

export function credentialMatchesTicket(ticket: Ticket): boolean {
  if (!ticket.credential) return false;
  try {
    const payload = z
      .object({ v: z.literal(1), tid: z.string(), sid: z.string(), kid: z.string() })
      .parse(JSON.parse(ticket.credential.payload));
    return (
      payload.tid === ticket.id && payload.sid === ticket.sessionId && payload.kid === ticket.credential.kid
    );
  } catch {
    return false;
  }
}
