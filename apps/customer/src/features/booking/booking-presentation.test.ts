import { describe, expect, it } from 'vitest';
import { canCancel, canPay, countdownRemaining, needsPolling } from './booking-presentation';
describe('booking authority remains on the server', () => {
  it('uses server clock plus elapsed time, including time away from the app', () => {
    const snapshot = { lockExpiresAt: '2026-10-14T01:10:00Z', serverNow: '2026-10-14T01:00:00Z' };
    expect(countdownRemaining(snapshot, 120000)).toBe(480000);
    expect(countdownRemaining(snapshot, 900000)).toBe(0);
  });
  it('does not allow cancel/re-payment when money may be in flight', () => {
    expect(canCancel({ status: 'PAYMENT_PENDING' })).toBe(false);
    expect(canPay({ status: 'PAYMENT_PENDING' }, 0)).toBe(false);
    expect(needsPolling('PAYMENT_PENDING')).toBe(true);
    expect(needsPolling('PAID')).toBe(true);
    expect(needsPolling('CONFIRMED')).toBe(false);
  });
});
