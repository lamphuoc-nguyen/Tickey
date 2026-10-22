import type { BookingItemInput } from '@event/core';
/** Never silently drop a selected seat whose price mapping changed. */
export function selectedSeatItems(selected: readonly string[], seatTypes: ReadonlyMap<string, string>) {
  const items: BookingItemInput[] = [];
  const missing: string[] = [];
  for (const seatId of selected) {
    const ticketTypeId = seatTypes.get(seatId);
    if (ticketTypeId) items.push({ seatId, ticketTypeId });
    else missing.push(seatId);
  }
  return { items, missing };
}

/** create_booking rejects a ticket type outside its own sale window, even while the Session is on sale. */
export function ticketTypeSaleState(
  type: { saleStartAt: string | null; saleEndAt: string | null },
  now: number,
): 'ON_SALE' | 'NOT_STARTED' | 'ENDED' {
  if (type.saleStartAt && now < Date.parse(type.saleStartAt)) return 'NOT_STARTED';
  if (type.saleEndAt && now >= Date.parse(type.saleEndAt)) return 'ENDED';
  return 'ON_SALE';
}

export function selectionLimit(
  items: BookingItemInput[],
  types: readonly { id: string; maxPerOrder: number }[],
  accountMaximum?: number,
): string | null {
  const quantities = new Map<string, number>();
  const seats = new Set<string>();
  let total = 0;
  for (const item of items) {
    const quantity = 'seatId' in item ? 1 : item.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < 1) return 'Số lượng vé phải là số nguyên lớn hơn 0.';
    if ('seatId' in item) {
      if (seats.has(item.seatId)) return 'Một ghế chỉ được chọn một lần.';
      seats.add(item.seatId);
    }
    total += quantity;
    quantities.set(item.ticketTypeId, (quantities.get(item.ticketTypeId) ?? 0) + quantity);
  }
  if (accountMaximum !== undefined && total > accountMaximum)
    return `Mỗi tài khoản chọn tối đa ${accountMaximum} vé cho suất diễn này.`;
  for (const [id, quantity] of quantities) {
    const type = types.find((t) => t.id === id);
    if (!type) return 'Chưa xác định được hạng vé cho lựa chọn này.';
    if (quantity > type.maxPerOrder) return `Số vé vượt giới hạn ${type.maxPerOrder} vé cho hạng đã chọn.`;
  }
  return null;
}
