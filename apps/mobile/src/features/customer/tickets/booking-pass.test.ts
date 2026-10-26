import { describe, expect, it } from 'vitest';
import { ticketSchema } from '@event/core';
import {
  bookingAdmissionState,
  bookingTicketRecords,
  groupTicketsByBooking,
  oldestDownload,
} from './booking-pass';

function ticket(id: string, bookingId: string, status = 'ISSUED') {
  return ticketSchema.parse({
    id,
    booking_id: bookingId,
    session_id: 'session',
    ticket_type_id: 'type',
    zone_id: null,
    seat_id: null,
    holder_name: 'An attendee, not the buyer',
    holder_email: null,
    holder_phone: null,
    status,
    used_at: null,
    issued_at: null,
    credential: null,
    seat: null,
    ticket_type: null,
    session: null,
  });
}

describe('booking admission presentation', () => {
  it('only puts the selected booking in its admission panel, including overlapping pages', () => {
    const one = ticket('one', 'a');
    const two = ticket('two', 'b');
    expect(bookingTicketRecords([one, two, one], 'a')).toEqual([one]);
    expect(bookingTicketRecords([one, two], 'b')).toEqual([two]);
    expect(bookingTicketRecords([one, two], 'unknown')).toEqual([]);
  });
  it('groups multiple people in one order while keeping different orders separate', () => {
    const first = Array.from({ length: 5 }, (_, i) => ticket(`a-${i}`, 'a'));
    const groups = groupTicketsByBooking([...first, ticket('b-1', 'b')]);
    expect(groups.map((g) => [g.bookingId, g.tickets.length])).toEqual([
      ['a', 5],
      ['b', 1],
    ]);
    expect(groups[0]?.tickets).toEqual(first);
  });

  it('does not duplicate a booking card or seat when pages overlap', () => {
    const one = ticket('one', 'a');
    expect(groupTicketsByBooking([one, one, ticket('two', 'a')])[0]?.tickets.map((t) => t.id)).toEqual([
      'one',
      'two',
    ]);
  });

  it('does not turn per-ticket USED status into a booking QR or a remaining-scan counter', () => {
    const group = groupTicketsByBooking([ticket('one', 'a', 'USED'), ticket('two', 'a')])[0]!;
    expect(group.tickets).toHaveLength(2);
    expect(bookingAdmissionState('CONFIRMED').title).toBe('Mã QR chung chưa khả dụng');
    expect(bookingAdmissionState('PARTIALLY_REFUNDED').title).toBe('Mã QR chung chưa khả dụng');
  });

  it('uses the oldest snapshot for the selected booking, never another order or a made-up refresh time', () => {
    const entries = [
      { ticket: ticket('one', 'a'), downloadedAt: '2026-10-20T10:00:00Z' },
      { ticket: ticket('two', 'a'), downloadedAt: '2026-10-20T11:00:00Z' },
      { ticket: ticket('three', 'b'), downloadedAt: '2026-10-19T00:00:00Z' },
    ];
    expect(oldestDownload(entries, 'a')).toBe('2026-10-20T10:00:00Z');
    expect(oldestDownload(entries, 'unknown')).toBeUndefined();
    expect(oldestDownload([{ ...entries[0]!, downloadedAt: 'invalid' }], 'a')).toBeUndefined();
  });

  it('keeps issuance and payment pending separate from a completed order', () => {
    expect(bookingAdmissionState('PAID').title).toBe('Đang phát hành vé');
    expect(bookingAdmissionState('PAYMENT_PENDING').title).toBe('Đang xác nhận thanh toán');
    expect(bookingAdmissionState('CANCELLED').title).toBe('Đơn không còn hiệu lực');
    expect(bookingAdmissionState('EXPIRED').title).toBe('Đơn không còn hiệu lực');
  });
});
