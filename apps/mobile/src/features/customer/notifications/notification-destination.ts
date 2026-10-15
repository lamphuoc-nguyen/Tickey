import { z } from 'zod';
export type NotificationDestination =
  { kind: 'ticket' | 'booking'; id: string } | { kind: 'tickets' | 'notifications' };
/** A link is a navigation hint only; screens still fetch the owned resource from the server. */
export function notificationDestination(data: unknown): NotificationDestination {
  const record = z.record(z.string(), z.unknown()).safeParse(data);
  if (!record.success) return { kind: 'notifications' };
  const values = record.data;
  const ticket = z.uuid().safeParse(values.ticketId ?? values.ticket_id);
  if (ticket.success) return { kind: 'ticket', id: ticket.data };
  const booking = z.uuid().safeParse(values.bookingId ?? values.booking_id);
  if (booking.success) return { kind: 'booking', id: booking.data };
  if (z.uuid().safeParse(values.sessionId ?? values.session_id).success) return { kind: 'tickets' };
  return { kind: 'notifications' };
}
