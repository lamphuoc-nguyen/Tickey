import type { BookingItemInput } from '@event/core';
export function selectionLimit(
  items: BookingItemInput[],
  types: readonly { id: string; maxPerOrder: number }[],
  accountMaximum?: number,
): string | null {
  const quantities = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    const quantity = 'seatId' in item ? 1 : item.quantity;
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
