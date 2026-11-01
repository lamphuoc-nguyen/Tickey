import type { BookingItemInput, BookingStatus } from '@event/core';

type PosType = {
  id: string;
  kind: string;
  status?: string;
  max_per_order?: number;
  zones: readonly { zone_id: string }[];
  inventory?: { quota: number; locked: number; sold: number } | null;
};
type PosZone = { id: string; type: 'seated' | 'standing'; seats: readonly { id: string }[] };

/** create_booking refuses COMP outside its own flow; POS may sell hidden tiers and ignores tier sale windows. */
export function sellableTicketTypes<T extends Pick<PosType, 'kind' | 'status'>>(types: readonly T[]): T[] {
  return types.filter((type) => type.kind !== 'COMP' && type.status === 'ACTIVE');
}

export function seatTypeMap(pricing: Readonly<Record<string, readonly string[]>>): Map<string, string> {
  return new Map(
    Object.entries(pricing).flatMap(([typeId, seatIds]) =>
      seatIds.map((seatId) => [seatId, typeId] as const),
    ),
  );
}

/** Same rule as create_booking: a priced seat sells only in its tier, an unpriced one in any tier of its zone. */
export function canSellSeat(
  type: Pick<PosType, 'id' | 'zones'>,
  zoneId: string,
  seatId: string,
  seatTypes: ReadonlyMap<string, string>,
): boolean {
  const assigned = seatTypes.get(seatId);
  return assigned ? assigned === type.id : type.zones.some((zone) => zone.zone_id === zoneId);
}

export function zonesForType<Z extends PosZone>(
  type: Pick<PosType, 'id' | 'zones'>,
  zones: readonly Z[],
  seatTypes: ReadonlyMap<string, string>,
): Z[] {
  return zones.filter((zone) =>
    zone.type === 'standing'
      ? type.zones.some((linked) => linked.zone_id === zone.id)
      : zone.seats.some((seat) => canSellSeat(type, zone.id, seat.id, seatTypes)),
  );
}

export function typeRemaining(type: Pick<PosType, 'inventory'>): number | undefined {
  return type.inventory ? type.inventory.quota - type.inventory.locked - type.inventory.sold : undefined;
}

/** How many tickets one order can take: seats and standing places share the tier's limits. */
export function orderLimit(
  type: Pick<PosType, 'max_per_order' | 'inventory'>,
  zoneRemaining: number = Number.POSITIVE_INFINITY,
): number {
  return Math.max(
    0,
    Math.min(
      type.max_per_order ?? Number.POSITIVE_INFINITY,
      typeRemaining(type) ?? Number.POSITIVE_INFINITY,
      zoneRemaining,
    ),
  );
}

export function posItems(input: {
  ticketTypeId: string;
  zone: Pick<PosZone, 'id' | 'type'>;
  quantity: number;
  seatIds: readonly string[];
}): BookingItemInput[] {
  return input.zone.type === 'standing'
    ? [{ ticketTypeId: input.ticketTypeId, zoneId: input.zone.id, quantity: input.quantity }]
    : input.seatIds.map((seatId) => ({ ticketTypeId: input.ticketTypeId, seatId }));
}

export type PosStage = 'AWAITING_PAYMENT' | 'ISSUING' | 'ISSUED' | 'CLOSED';

export function posStage(status: BookingStatus): PosStage {
  if (status === 'PENDING' || status === 'PAYMENT_PENDING') return 'AWAITING_PAYMENT';
  if (status === 'PAID') return 'ISSUING';
  return status === 'CONFIRMED' ? 'ISSUED' : 'CLOSED';
}

export function formatHold(remainingMs: number): string {
  const seconds = Math.ceil(remainingMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
