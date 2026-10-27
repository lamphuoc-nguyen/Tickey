import { expect, it } from 'vitest';
import { orderHasTickets, orderInView, orderView } from './order-presentation';
it('starts in purchased tickets and keeps existing direct tab links valid', () => {
  expect(orderView()).toBe('tickets');
  expect(orderView('unknown')).toBe('tickets');
  expect(orderView('processing')).toBe('processing');
  expect(orderView('all')).toBe('all');
  expect(orderView('saved')).toBe('saved');
});
it('does not open payment or issuance pending orders as issued tickets', () => {
  for (const status of ['PENDING', 'PAYMENT_PENDING', 'PAID', 'REFUND_PENDING'] as const) {
    expect(orderHasTickets({ status })).toBe(false);
    expect(orderInView({ status }, 'processing')).toBe(true);
    expect(orderInView({ status }, 'tickets')).toBe(false);
  }
  expect(orderHasTickets({ status: 'CONFIRMED' })).toBe(true);
  expect(orderHasTickets({ status: 'PARTIALLY_REFUNDED' })).toBe(true);
});
it('keeps expired, cancelled and fully refunded orders accessible through history', () => {
  for (const status of ['EXPIRED', 'CANCELLED', 'REFUNDED'] as const) {
    expect(orderInView({ status }, 'all')).toBe(true);
    expect(orderInView({ status }, 'tickets')).toBe(false);
    expect(orderInView({ status }, 'processing')).toBe(false);
  }
});
