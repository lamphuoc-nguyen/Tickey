import { describe, expect, it } from 'vitest';
import { bookingIntent, keepNonConflictingSelections } from './booking-intent';
describe('one idempotency key per booking intent', () => {
  const items = [
    { ticketTypeId: 'standard', seatId: 'A5' },
    { ticketTypeId: 'standard', seatId: 'A6' },
  ];
  it('replays the same key and original payload after a lost response', () => {
    const first = bookingIntent(null, 'session', items, () => 'first');
    expect(bookingIntent(first, 'session', [...items].reverse(), () => 'second')).toBe(first);
  });
  it('replays original seat/type bindings even if a background catalog refresh changes them', () => {
    const first = bookingIntent(null, 'session', items, () => 'first');
    expect(
      bookingIntent(first, 'session', [{ ticketTypeId: 'new-type', seatId: 'A5' }], () => 'new', true),
    ).toBe(first);
  });
  it('never reuses a key when a seat, session, quantity or zone changes', () => {
    const first = bookingIntent(null, 'session', items, () => 'first');
    expect(bookingIntent(first, 'session', [items[0]!], () => 'second').idempotencyKey).toBe('second');
    expect(bookingIntent(first, 'session2', items, () => 'third').idempotencyKey).toBe('third');
    const standing = bookingIntent(
      null,
      'session',
      [{ ticketTypeId: 'ga', zoneId: 'zone', quantity: 1 }],
      () => 'one',
    );
    expect(
      bookingIntent(standing, 'session', [{ ticketTypeId: 'ga', zoneId: 'zone', quantity: 2 }], () => 'two')
        .idempotencyKey,
    ).toBe('two');
  });
  it('keeps non-conflicting selections without claiming they are held', () => {
    expect(keepNonConflictingSelections(['A5', 'A6'], ['A5'])).toEqual(['A6']);
  });
});
