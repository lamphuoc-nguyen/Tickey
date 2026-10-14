import { z } from 'zod';
import { mapDatabaseJson } from './database-mapper';

const nullableText = z.string().nullable();
export const sessionStatus = z.enum([
  'SCHEDULED',
  'ON_SALE',
  'SALES_CLOSED',
  'ONGOING',
  'ENDED',
  'POSTPONED',
  'CANCELLED',
]);
const categoryJson = z.object({ id: z.string(), slug: z.string(), name: z.string(), sort_order: z.number() });
export const venueSchema = z.object({
  id: z.string(),
  name: z.string(),
  address_line: z.string(),
  city: z.string(),
  timezone: z.string(),
  map_image_url: nullableText.optional(),
  ward: nullableText.optional(),
  district: nullableText.optional(),
});
const sessionSummarySchema = z.object({
  id: z.string(),
  title: nullableText,
  starts_at: z.string(),
  ends_at: z.string().optional(),
  status: sessionStatus,
});
const eventJson = z.object({
  id: z.string(),
  tenant_id: z.string(),
  title: z.string(),
  slug: z.string(),
  summary: nullableText,
  description: nullableText.optional(),
  cover_image_url: nullableText,
  category_id: nullableText,
  age_limit: z.number().nullable(),
  is_featured: z.boolean(),
  status: z.string(),
  terms: nullableText.optional(),
  sessions: z.array(sessionSummarySchema).optional(),
  category: categoryJson.pick({ id: true, slug: true, name: true }).nullable().optional(),
});
const sessionJson = sessionSummarySchema.extend({
  event_id: z.string(),
  ends_at: z.string(),
  doors_open_at: z.string(),
  sales_start_at: z.string(),
  sales_end_at: z.string(),
  sales_paused: z.boolean(),
  max_tickets_per_account: z.number().int().positive(),
  venue: venueSchema.nullable(),
});
const ticketTypeJson = z.object({
  id: z.string(),
  session_id: z.string(),
  name: z.string(),
  description: nullableText,
  kind: z.enum(['PAID', 'FREE', 'COMP']),
  price_amount: z.number().int().nonnegative(),
  max_per_order: z.number().int().positive(),
  sale_start_at: nullableText,
  sale_end_at: nullableText,
  visibility: z.string(),
  status: z.string(),
  refund_policy: z.string(),
  refund_deadline_hours: z.number().nullable(),
});
const seatSchema = z.object({
  id: z.string(),
  code: z.string(),
  row: z.string(),
  number: z.string(),
  x: z.number(),
  y: z.number(),
  flags: z.array(z.string()),
  section: nullableText,
});
const layoutJson = z.object({
  session_id: z.string(),
  layout_version_id: z.string(),
  version: z.number().int(),
  timezone: z.string(),
  zones: z.array(
    z.discriminatedUnion('type', [
      z.object({
        id: z.string(),
        code: z.string(),
        name: z.string(),
        type: z.literal('seated'),
        capacity: z.number(),
        color: nullableText,
        seats: z.array(seatSchema),
      }),
      z.object({
        id: z.string(),
        code: z.string(),
        name: z.string(),
        type: z.literal('standing'),
        capacity: z.number(),
        color: nullableText,
        seats: z.array(seatSchema),
      }),
    ]),
  ),
});
const availabilityJson = z.object({
  server_now: z.string(),
  session_status: sessionStatus,
  sales_paused: z.boolean(),
  unavailable_seats: z.record(z.string(), z.enum(['LOCKED', 'SOLD', 'BLOCKED', 'HELD'])),
  zones: z.array(z.object({ zone_id: z.string(), remaining: z.number().int() })),
  ticket_types: z.array(z.object({ ticket_type_id: z.string(), remaining: z.number().int() })),
});
export const seatPricingSchema = z.record(z.string(), z.array(z.string()));
export const categorySchema = categoryJson.transform(mapDatabaseJson);
export const eventSchema = eventJson.transform(mapDatabaseJson);
export const sessionSchema = sessionJson.transform(mapDatabaseJson);
export const ticketTypeSchema = ticketTypeJson.transform(mapDatabaseJson);
export const layoutSchema = layoutJson.transform(mapDatabaseJson);
export const availabilitySchema = availabilityJson.transform(mapDatabaseJson);
export type Event = z.infer<typeof eventSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type TicketType = z.infer<typeof ticketTypeSchema>;
export type SessionLayout = z.infer<typeof layoutSchema>;
export type Availability = z.infer<typeof availabilitySchema>;
export type Category = z.infer<typeof categorySchema>;

export function formatMoney(amount: number): string {
  return amount === 0 ? 'Miễn phí' : `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}
export function formatSessionTime(date: string, timezone = 'Asia/Ho_Chi_Minh'): string {
  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(date));
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')} · ${value('hour')}:${value('minute')}`;
}
