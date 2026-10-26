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
  return (booking.status === 'PENDING' || booking.status === 'PAYMENT_PENDING') && remaining > 0;
}
export function canCancel(booking: Pick<Booking, 'status'>): boolean {
  return booking.status === 'PENDING';
}
export function needsPolling(status: BookingStatus): boolean {
  return ['PENDING', 'PAYMENT_PENDING', 'PAID', 'REFUND_PENDING'].includes(status);
}

export function pollingInterval(
  booking: Pick<Booking, 'status' | 'lockExpiresAt' | 'serverNow'>,
  elapsedMs: number,
): number | false {
  if (!needsPolling(booking.status)) return false;
  if (booking.status !== 'PAYMENT_PENDING') return 3000;

  const serverRemaining = booking.lockExpiresAt
    ? Date.parse(booking.lockExpiresAt) - Date.parse(booking.serverNow)
    : 0;
  const overdueMs = elapsedMs - serverRemaining;

  // lock_expires_at > server_now (session still active)
  if (overdueMs <= 0) return 3000;
  // lock_expires_at <= server_now (backoff: 3s -> 10s -> 30s -> stop after 10m)
  if (overdueMs < 30_000) return 3000;
  if (overdueMs < 120_000) return 10_000;
  if (overdueMs < 600_000) return 30_000;
  return false;
}
