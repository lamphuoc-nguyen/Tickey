import type { Booking } from '@event/core';
type Outcome = {
  title: string;
  description: string;
  badge: string;
  kind: 'waiting' | 'success' | 'warning' | 'expired';
};
export function bookingOutcome(booking: Pick<Booking, 'status' | 'totalAmount' | 'itemCount'>): Outcome {
  switch (booking.status) {
    case 'PAID':
      return {
        title: 'Đang phát hành vé',
        description: 'Đơn đã được thanh toán. Vé đang được phát hành.',
        badge: 'Đang phát hành vé',
        kind: 'waiting',
      };
    case 'PAYMENT_PENDING':
      return {
        title: 'Đang xác nhận thanh toán',
        description: 'Chưa có kết quả cuối cùng từ cổng thanh toán.',
        badge: 'Đang xác nhận',
        kind: 'waiting',
      };
    case 'CONFIRMED':
      return {
        title:
          booking.totalAmount === 0 ? `Đã phát hành ${booking.itemCount} vé miễn phí` : 'Đặt vé thành công',
        description: 'Vé đã được phát hành. Mỗi người sử dụng một vé riêng.',
        badge: 'Đã phát hành vé',
        kind: 'success',
      };
    case 'EXPIRED':
      return {
        title: 'Đã hết hạn giữ chỗ',
        description: 'Chỗ đã được trả lại. Vui lòng chọn chỗ mới.',
        badge: 'Hết hạn',
        kind: 'expired',
      };
    case 'CANCELLED':
      return {
        title: 'Đơn đã hủy',
        description: 'Đơn không còn hiệu lực. Bạn có thể chọn vé mới.',
        badge: 'Đã hủy',
        kind: 'warning',
      };
    case 'REFUND_PENDING':
      return {
        title: 'Đang xử lý hoàn tiền',
        description: 'Chưa có xác nhận đã hoàn tất hoàn tiền.',
        badge: 'Đang xử lý hoàn tiền',
        kind: 'waiting',
      };
    case 'PARTIALLY_REFUNDED':
      return {
        title: 'Đã hoàn một phần',
        description: 'Xem chi tiết yêu cầu để biết số tiền đã được hoàn.',
        badge: 'Đã hoàn một phần',
        kind: 'warning',
      };
    case 'REFUNDED':
      return {
        title: 'Đã hoàn tiền',
        description: 'Đơn đã được hoàn theo trạng thái được xác nhận.',
        badge: 'Đã hoàn tiền',
        kind: 'success',
      };
    case 'PENDING':
      return {
        title: 'Đang giữ chỗ',
        description: 'Kiểm tra thời gian giữ chỗ và đơn trước khi tiếp tục.',
        badge: 'Đang giữ chỗ',
        kind: 'warning',
      };
  }
}
