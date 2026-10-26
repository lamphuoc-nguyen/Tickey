import { holdRemainingMs, type Booking, type BookingStatus } from '@event/core';
export const bookingLabels: Record<BookingStatus, string> = {
  PENDING: 'Đang giữ chỗ',
  PAYMENT_PENDING: 'Đang xác nhận thanh toán',
  PAID: 'Đang phát hành vé',
  CONFIRMED: 'Đã xác nhận · Vé đã phát hành',
  CANCELLED: 'Đã hủy đơn',
  EXPIRED: 'Đã hết hạn giữ chỗ',
  REFUND_PENDING: 'Đang xử lý hoàn tiền',
  PARTIALLY_REFUNDED: 'Đã hoàn một phần',
  REFUNDED: 'Đã hoàn tiền',
};
export function countdownRemaining(
  booking: Pick<Booking, 'lockExpiresAt' | 'serverNow'>,
  elapsedMs: number,
): number {
  return Math.max(0, holdRemainingMs(booking) - Math.max(0, elapsedMs));
}
export function canPay(booking: Pick<Booking, 'status'>, remaining: number): boolean {
  return booking.status === 'PENDING' && remaining > 0;
}
export function canCancel(booking: Pick<Booking, 'status'>): boolean {
  return booking.status === 'PENDING';
}
export function needsPolling(status: BookingStatus): boolean {
  return ['PENDING', 'PAYMENT_PENDING', 'PAID', 'REFUND_PENDING'].includes(status);
}
