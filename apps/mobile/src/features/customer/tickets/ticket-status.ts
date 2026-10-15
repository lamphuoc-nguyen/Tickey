import type { Ticket } from '@event/core';
export const ticketStatusLabels: Record<Ticket['status'], string> = {
  ISSUED: 'Đã phát hành',
  USED: 'Đã sử dụng',
  NO_SHOW: 'Không tham dự',
  VOID: 'Mất hiệu lực',
  REFUND_PENDING: 'Đang xử lý hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
};
