import { describe, expect, it } from 'vitest';
import { canCancel, canPay, countdownRemaining, needsPolling, pollingInterval } from './booking-presentation';

describe('booking authority remains on the server', () => {
  it('uses server clock plus elapsed time, including time away from the app', () => {
    const snapshot = { lockExpiresAt: '2026-10-14T01:10:00Z', serverNow: '2026-10-14T01:00:00Z' };
    expect(countdownRemaining(snapshot, 120000)).toBe(480000);
    expect(countdownRemaining(snapshot, 900000)).toBe(0);
  });

  it('handles canPay and canCancel according to contract', () => {
    expect(canCancel({ status: 'PAYMENT_PENDING' })).toBe(false);
    expect(canCancel({ status: 'PENDING' })).toBe(true);
    expect(canPay({ status: 'PAYMENT_PENDING' }, 0)).toBe(false);
    expect(canPay({ status: 'PAYMENT_PENDING' }, 60000)).toBe(true);
    expect(canPay({ status: 'PENDING' }, 60000)).toBe(true);
    expect(needsPolling('PAYMENT_PENDING')).toBe(true);
    expect(needsPolling('PAID')).toBe(true);
    expect(needsPolling('CONFIRMED')).toBe(false);
  });

  it('backs off polling interval for PAYMENT_PENDING when lock expires', () => {
    const activeSnapshot = {
      status: 'PAYMENT_PENDING' as const,
      lockExpiresAt: '2026-10-14T01:10:00Z',
      serverNow: '2026-10-14T01:00:00Z',
    };
    // Holding still active (elapsed 5m out of 10m)
    expect(pollingInterval(activeSnapshot, 300000)).toBe(3000);

    // Expired: overdue < 30s
    expect(pollingInterval(activeSnapshot, 610000)).toBe(3000);

    // Expired: overdue 60s (between 30s and 2m)
    expect(pollingInterval(activeSnapshot, 660000)).toBe(10000);

    // Expired: overdue 5m (between 2m and 10m)
    expect(pollingInterval(activeSnapshot, 900000)).toBe(30000);

    // Expired: overdue > 10m -> stops polling
    expect(pollingInterval(activeSnapshot, 1300000)).toBe(false);
  });

  it('polls PAID at fixed 3000ms and CONFIRMED at false', () => {
    expect(pollingInterval({ status: 'PAID', lockExpiresAt: null, serverNow: '2026-10-14T01:00:00Z' }, 0)).toBe(3000);
    expect(pollingInterval({ status: 'CONFIRMED', lockExpiresAt: null, serverNow: '2026-10-14T01:00:00Z' }, 0)).toBe(false);
  });
});
