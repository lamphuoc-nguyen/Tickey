import type { Ticket } from '@event/core';
import type { SavedTicket } from './ticket-cache';

/** Group real records only. A page or offline subset is not proof of the order's total capacity. */
export function groupTicketsByBooking(tickets: readonly Ticket[]) {
  const groups = new Map<string, Ticket[]>();
  const seen = new Set<string>();
  for (const ticket of tickets) {
    if (seen.has(ticket.id)) continue;
    seen.add(ticket.id);
    const group = groups.get(ticket.bookingId) ?? [];
    group.push(ticket);
    groups.set(ticket.bookingId, group);
  }
  return [...groups].map(([bookingId, records]) => ({ bookingId, tickets: records }));
}

export function oldestDownload(entries: readonly SavedTicket[], bookingId: string): string | undefined {
  const times = entries.filter((s) => s.ticket.bookingId === bookingId).map((s) => s.downloadedAt);
  if (!times.length || times.some((time) => !Number.isFinite(Date.parse(time)))) return undefined;
  return times.reduce((oldest, time) => (Date.parse(time) < Date.parse(oldest) ? time : oldest));
}

export function bookingTicketRecords(tickets: readonly Ticket[], bookingId?: string): Ticket[] {
  return groupTicketsByBooking(tickets.filter((ticket) => ticket.bookingId === bookingId))[0]?.tickets ?? [];
}

/** Ticket v1 credentials/statuses do not define a multi-use booking credential or its remaining scans. */
export function bookingAdmissionState(status?: string) {
  if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'REFUNDED')
    return { title: 'Đơn không còn hiệu lực', description: 'Đơn này không dùng để vào cổng.' };
  if (status === 'PAID')
    return { title: 'Đang phát hành vé', description: 'Vé sẽ hiển thị sau khi phát hành.' };
  if (status === 'PAYMENT_PENDING')
    return { title: 'Đang xác nhận thanh toán', description: 'Chờ kết quả thanh toán của đơn.' };
  if (status === 'PENDING')
    return { title: 'Chưa hoàn tất đặt vé', description: 'Hoàn tất đơn để nhận vé vào cổng.' };
  return {
    title: 'Mã QR chung chưa khả dụng',
    description: 'Chưa có mã vào cổng và thông tin lượt sử dụng cho đơn này.',
  };
}
