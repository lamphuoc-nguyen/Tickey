import { describe, it, expect } from 'vitest';
import { notificationDestination } from './notification-destination';
describe('notification links', () => {
  it('accepts either database or client casing without accepting malformed ids', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(notificationDestination({ ticket_id: id })).toEqual({ kind: 'ticket', id });
    expect(notificationDestination({ bookingId: '------------------------------------' })).toEqual({
      kind: 'notifications',
    });
  });
  it('never derives a payment result from the link payload', () => {
    expect(notificationDestination({ status: 'CONFIRMED', success: true })).toEqual({
      kind: 'notifications',
    });
  });
});
