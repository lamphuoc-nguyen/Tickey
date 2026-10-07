import { describe, expect, it } from 'vitest';
import { holdRemainingMs, parseBooking, toItemJson } from './booking';

const sample = {
  id: 'b1',
  code: 'BK-0001',
  status: 'PENDING',
  booking_type: 'ONLINE',
  session_id: 's1',
  item_count: 1,
  list_amount: 500000,
  discount_amount: 0,
  total_amount: 500000,
  currency: 'VND',
  lock_expires_at: '2026-10-07T10:10:00+00:00',
  payment_deadline_at: null,
  server_now: '2026-10-07T10:00:00+00:00',
  items: [
    {
      ticket_type_id: 't1',
      zone_id: 'z1',
      seat_id: 'seat1',
      seat_code: 'A-1-1',
      quantity: 1,
      unit_list_price: 500000,
      unit_discount: 0,
      unit_price: 500000,
    },
  ],
};

describe('parseBooking', () => {
  it('maps booking_to_json to the camelCase model', () => {
    const b = parseBooking(sample);
    expect(b.status).toBe('PENDING');
    expect(b.items[0]?.seatCode).toBe('A-1-1');
  });

  it('rejects an unknown status', () => {
    expect(() => parseBooking({ ...sample, status: 'paid' })).toThrow();
  });
});

describe('holdRemainingMs', () => {
  it('counts down from the server clock, not the device clock', () => {
    expect(holdRemainingMs(parseBooking(sample))).toBe(10 * 60 * 1000);
  });
});

describe('toItemJson', () => {
  it('sends seats and standing quantities without prices', () => {
    expect(toItemJson({ ticketTypeId: 't1', seatId: 'seat1' })).toEqual({
      ticket_type_id: 't1',
      seat_id: 'seat1',
    });
    expect(toItemJson({ ticketTypeId: 't2', quantity: 2 })).toEqual({ ticket_type_id: 't2', quantity: 2 });
  });
});
