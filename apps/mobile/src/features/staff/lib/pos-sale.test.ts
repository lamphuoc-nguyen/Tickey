import { describe, expect, it } from 'vitest';
import {
  canSellSeat,
  formatHold,
  orderLimit,
  posItems,
  posStage,
  seatTypeMap,
  sellableTicketTypes,
  typeRemaining,
  zonesForType,
} from './pos-sale';

const seatedZone = { id: 'z-seated', type: 'seated' as const, seats: [{ id: 's1' }, { id: 's2' }] };
const standingZone = { id: 'z-standing', type: 'standing' as const, seats: [] };
const vip = { id: 'vip', zones: [] };
const standing = { id: 'floor', zones: [{ zone_id: 'z-standing' }] };

describe('sellableTicketTypes', () => {
  it('keeps active paid and free tiers, including hidden ones, and drops COMP and inactive tiers', () => {
    const types = [
      { id: 'paid', kind: 'PAID', status: 'ACTIVE', visibility: 'HIDDEN' },
      { id: 'free', kind: 'FREE', status: 'ACTIVE' },
      { id: 'comp', kind: 'COMP', status: 'ACTIVE' },
      { id: 'off', kind: 'PAID', status: 'INACTIVE' },
    ];
    expect(sellableTicketTypes(types).map((type) => type.id)).toEqual(['paid', 'free']);
  });
});

describe('canSellSeat', () => {
  const seatTypes = seatTypeMap({ vip: ['s1'], other: ['s2'] });

  it('sells a priced seat only in its own tier', () => {
    expect(canSellSeat(vip, 'z-seated', 's1', seatTypes)).toBe(true);
    expect(canSellSeat(vip, 'z-seated', 's2', seatTypes)).toBe(false);
  });

  it('sells an unpriced seat only in a tier linked to its zone', () => {
    expect(canSellSeat({ id: 'a', zones: [{ zone_id: 'z-seated' }] }, 'z-seated', 's9', seatTypes)).toBe(
      true,
    );
    expect(canSellSeat({ id: 'a', zones: [] }, 'z-seated', 's9', seatTypes)).toBe(false);
  });

  it('does not let a zone link override the tier a seat is priced in', () => {
    expect(canSellSeat({ id: 'a', zones: [{ zone_id: 'z-seated' }] }, 'z-seated', 's1', seatTypes)).toBe(
      false,
    );
  });
});

describe('zonesForType', () => {
  const zones = [seatedZone, standingZone];

  it('finds a seated tier through its priced seats even with no zone link', () => {
    expect(zonesForType(vip, zones, seatTypeMap({ vip: ['s1'] }))).toEqual([seatedZone]);
  });

  it('finds a standing tier through its zone link', () => {
    expect(zonesForType(standing, zones, new Map())).toEqual([standingZone]);
  });

  it('returns nothing for a tier with no seats or zones', () => {
    expect(zonesForType(vip, zones, new Map())).toEqual([]);
  });
});

describe('orderLimit', () => {
  it('takes the smallest of the per-order limit, tier stock and zone stock', () => {
    const inventory = { quota: 10, locked: 2, sold: 3 };
    expect(typeRemaining({ inventory })).toBe(5);
    expect(orderLimit({ max_per_order: 4, inventory })).toBe(4);
    expect(orderLimit({ max_per_order: 8, inventory })).toBe(5);
    expect(orderLimit({ max_per_order: 8, inventory }, 2)).toBe(2);
  });

  it('never goes below zero when stock is oversold', () => {
    expect(orderLimit({ max_per_order: 4, inventory: { quota: 1, locked: 2, sold: 0 } })).toBe(0);
  });
});

describe('posItems', () => {
  it('sends one line per seat for a seated zone, with no quantity or zone', () => {
    expect(posItems({ ticketTypeId: 'vip', zone: seatedZone, quantity: 1, seatIds: ['s1', 's2'] })).toEqual([
      { ticketTypeId: 'vip', seatId: 's1' },
      { ticketTypeId: 'vip', seatId: 's2' },
    ]);
  });

  it('sends the chosen zone and quantity for a standing zone', () => {
    expect(posItems({ ticketTypeId: 'floor', zone: standingZone, quantity: 3, seatIds: [] })).toEqual([
      { ticketTypeId: 'floor', zoneId: 'z-standing', quantity: 3 },
    ]);
  });
});

describe('posStage', () => {
  it('maps every booking status to what the counter can do next', () => {
    expect(posStage('PENDING')).toBe('AWAITING_PAYMENT');
    expect(posStage('PAYMENT_PENDING')).toBe('AWAITING_PAYMENT');
    expect(posStage('PAID')).toBe('ISSUING');
    expect(posStage('CONFIRMED')).toBe('ISSUED');
    for (const status of [
      'CANCELLED',
      'EXPIRED',
      'REFUND_PENDING',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
    ] as const)
      expect(posStage(status)).toBe('CLOSED');
  });
});

describe('formatHold', () => {
  it('shows minutes and padded seconds, rounding up', () => {
    expect(formatHold(600_000)).toBe('10:00');
    expect(formatHold(61_500)).toBe('1:02');
    expect(formatHold(0)).toBe('0:00');
  });
});
