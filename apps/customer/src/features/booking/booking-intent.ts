import type { BookingItemInput, CreateBookingParams } from '@event/core';

export function payloadFingerprint(sessionId: string, items: BookingItemInput[]): string {
  return JSON.stringify({
    sessionId,
    items: items
      .map((i) =>
        'seatId' in i
          ? { ticketTypeId: i.ticketTypeId, seatId: i.seatId }
          : { ticketTypeId: i.ticketTypeId, zoneId: i.zoneId ?? null, quantity: i.quantity },
      )
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  });
}
/** The original payload stays paired with its key; never reuse the key with edited selections. */
export function bookingIntent(
  previous: CreateBookingParams | null,
  sessionId: string,
  items: BookingItemInput[],
  uuid: () => string,
  unresolved = false,
): CreateBookingParams {
  if (previous && unresolved) {
    if (previous.sessionId !== sessionId) throw new Error('Ý định đặt vé đang chờ kết quả thuộc suất khác.');
    return previous;
  }
  if (
    previous &&
    payloadFingerprint(previous.sessionId, previous.items) === payloadFingerprint(sessionId, items)
  )
    return previous;
  return { sessionId, items, idempotencyKey: uuid() };
}
export function keepNonConflictingSelections(selected: string[], conflicts: string[]): string[] {
  const blocked = new Set(conflicts);
  return selected.filter((id) => !blocked.has(id));
}
