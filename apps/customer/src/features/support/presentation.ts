export const reportCategoryLabels: Record<string, string> = {
  NOT_AS_DESCRIBED: 'Nội dung sự kiện',
  EVENT_NOT_HELD: 'Sự kiện không diễn ra',
  ENTRY_DENIED: 'Bị từ chối vào cổng',
  SAFETY: 'An toàn',
  SEAT_ISSUE: 'Vấn đề chỗ ngồi',
  OTHER: 'Khác',
};
export const supportCategoryLabels: Record<string, string> = {
  PAYMENT: 'Thanh toán',
  TICKET: 'Vé',
  REFUND: 'Hoàn tiền',
  ACCOUNT: 'Tài khoản',
  APP_BUG: 'Lỗi ứng dụng',
  OTHER: 'Khác',
};
export const statusLabels: Record<string, string> = {
  SUBMITTED: 'Đã tiếp nhận',
  OPEN: 'Đã tiếp nhận',
  IN_REVIEW: 'Đang xem xét',
  IN_PROGRESS: 'Đang xử lý',
  UNDER_REVIEW: 'Đang xem xét',
  AWAITING_CUSTOMER: 'Cần thêm thông tin',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
  ACCEPTED: 'Đã tiếp nhận',
  REJECTED: 'Không được chấp thuận',
  NEEDS_INFO: 'Cần thêm thông tin',
  PROCESSING: 'Đang xử lý',
};
export function visibleStatus(status: string) {
  return status === 'WAITING_CUSTOMER'
    ? 'Cần thêm thông tin'
    : status === 'IN_CASE'
      ? 'Đang được xem xét'
      : (statusLabels[status] ?? 'Chưa thể hiển thị trạng thái này.');
}
