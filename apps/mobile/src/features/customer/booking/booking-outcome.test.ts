import { describe, it, expect } from 'vitest';
import { bookingOutcome } from './booking-outcome';
describe('server-derived result UI', () => {
  it('does not treat receipt of payment as completed ticket issuance', () => {
    expect(bookingOutcome({ status: 'PAID', totalAmount: 0, itemCount: 2 })).toMatchObject({
      title: 'Đang phát hành vé',
      kind: 'waiting',
    });
    expect(bookingOutcome({ status: 'CONFIRMED', totalAmount: 0, itemCount: 2 }).title).toBe(
      'Đã phát hành 2 vé miễn phí',
    );
  });
  it('does not label cancelled bookings as processing or refund pending as refunded', () => {
    expect(bookingOutcome({ status: 'CANCELLED', totalAmount: 1, itemCount: 1 }).kind).toBe('warning');
    expect(bookingOutcome({ status: 'REFUND_PENDING', totalAmount: 1, itemCount: 1 }).title).toBe(
      'Đang xử lý hoàn tiền',
    );
  });
});
