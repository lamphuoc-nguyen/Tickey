import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

// Đơn vé (bookings) và vé mời COMP của Org, đọc từ /api (JSON của database, đã đổi sang camelCase).

/**
 * buyer_snapshot: đơn CUSTOMER lưu full_name / email / phone, đơn COMP và POS lưu
 * holder_name / holder_email / holder_phone. Kiểm tra cả hai vì loại đơn quyết định khóa.
 */
export interface BuyerSnapshot {
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  taxCode?: string | null;
  holderName?: string | null;
  holderEmail?: string | null;
  holderPhone?: string | null;
  issuedBy?: string | null;
  soldBy?: string | null;
}

export interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  ticketTypeId: string;
  seatId: string | null;
  zoneId: string | null;
  ticketType: { name: string; kind: string } | null;
  seat: { seatCode: string } | null;
}

export interface OrderPayment {
  gateway: string;
  amount: number;
  status: string;
  paidAt: string | null;
  initiatedAt?: string | null;
}

export interface OrderTicket {
  id: string;
  status: string;
  holderName: string | null;
  holderEmail: string | null;
  ticketType: { name: string; kind: string } | null;
  seat: { seatCode: string } | null;
}

export interface Order {
  id: string;
  code: string;
  status: string;
  bookingType: string;
  sessionId: string;
  itemCount: number;
  listAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  buyerSnapshot: BuyerSnapshot | null;
  createdAt: string;
  paidAt: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  expiredAt: string | null;
  flagged: boolean;
  flagReason: string | null;
  session: {
    id: string;
    title: string | null;
    startsAt: string;
    endsAt: string | null;
    event: { id: string; title: string } | null;
  } | null;
  items: OrderItem[];
  payments: OrderPayment[];
  tickets?: OrderTicket[];
}

export const BOOKING_STATUS: Record<string, { label: string; badge: string }> = {
  PENDING: { label: 'Đang chờ thanh toán', badge: 'badge-warning' },
  PAYMENT_PENDING: { label: 'Đang chuyển khoản', badge: 'badge-warning' },
  PAID: { label: 'Đã thanh toán', badge: 'badge-success' },
  CONFIRMED: { label: 'Đã xác nhận', badge: 'badge-success' },
  CANCELLED: { label: 'Đã hủy', badge: 'badge-danger' },
  EXPIRED: { label: 'Hết hạn', badge: 'badge-danger' },
  REFUND_PENDING: { label: 'Chờ hoàn tiền', badge: 'badge-warning' },
  PARTIALLY_REFUNDED: { label: 'Hoàn một phần', badge: 'badge-warning' },
  REFUNDED: { label: 'Đã hoàn tiền', badge: 'badge-info' },
};

export const BOOKING_TYPE: Record<string, string> = {
  CUSTOMER: 'Khách hàng',
  COMP: 'Vé mời',
  POS: 'Bán tại quầy',
  B2B: 'Doanh nghiệp',
};

export const PAYMENT_STATUS: Record<string, string> = {
  INITIATED: 'Đã tạo phiếu',
  SUCCEEDED: 'Thành công',
  FAILED: 'Thất bại',
  EXPIRED: 'Hết hạn',
  AMOUNT_MISMATCH: 'Sai số tiền',
};

export const TICKET_STATUS: Record<string, string> = {
  ISSUED: 'Đã phát',
  USED: 'Đã soát vé',
  NO_SHOW: 'Không đến',
  VOID: 'Vô hiệu',
  REFUND_PENDING: 'Chờ hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
};

/** Tên người mua: đơn CUSTOMER lấy full_name, đơn COMP / POS lấy holder_name. */
export const buyerName = (order: Order) =>
  order.buyerSnapshot?.fullName?.trim() ||
  order.buyerSnapshot?.holderName?.trim() ||
  'Khách không cập nhật tên';

export const buyerEmail = (order: Order) =>
  order.buyerSnapshot?.email?.trim() || order.buyerSnapshot?.holderEmail?.trim() || '';

/** Ghế đã bán, kèm hạng vé (mỗi dòng một vé). */
export const orderSeats = (order: Order) =>
  order.items
    .map((item) => ({
      seat: item.seat?.seatCode ?? (item.zoneId ? 'Khu đứng' : 'Vé chung'),
      ticketType: item.ticketType?.name ?? '—',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }))
    .filter((row) => row.quantity > 0);

export const seatCodes = (order: Order) =>
  orderSeats(order)
    .map((row) => row.seat)
    .join(', ');

export interface OrderQuery {
  status?: string;
  type?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

const orderQuery = (params: OrderQuery) => {
  const search = new URLSearchParams();
  if (params.status) search.set('status', params.status);
  if (params.type) search.set('type', params.type);
  if (params.q?.trim()) search.set('q', params.q.trim());
  search.set('limit', String(params.limit ?? 50));
  search.set('offset', String(params.offset ?? 0));
  return search.toString();
};

/** Đơn vé của Org. type: CUSTOMER | COMP | POS | B2B; q tìm theo mã đơn, tên và email. */
export function useOrgOrders(orgId: string | null, params: OrderQuery = {}) {
  return useQuery({
    queryKey: ['org', orgId, 'orders', params],
    queryFn: () => api.get<Order[]>(`/api/organizations/${orgId}/orders?${orderQuery(params)}`),
    enabled: !!orgId,
  });
}

/** Chi tiết một đơn vé: gồm vé đã phát và lịch sử thanh toán. */
export function useOrgOrder(orgId: string | null, bookingId: string | null | undefined) {
  return useQuery({
    queryKey: ['org', orgId, 'order', bookingId],
    queryFn: () => api.get<Order>(`/api/organizations/${orgId}/orders/${bookingId}`),
    enabled: !!orgId && !!bookingId,
  });
}

/** Vé mời COMP đã phát của Org, mới nhất trước. */
export function useOrgCompTickets(orgId: string | null, sessionId?: string) {
  return useQuery({
    queryKey: ['org', orgId, 'comp-tickets', sessionId ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100' });
      if (sessionId) search.set('sessionId', sessionId);
      return api.get<Order[]>(`/api/organizations/${orgId}/comp-tickets?${search.toString()}`);
    },
    enabled: !!orgId,
  });
}

export interface CompRecipientInput {
  email: string;
  name?: string | null;
  phone?: string | null;
  seatId?: string | null;
  zoneId?: string | null;
  quantity?: number | null;
}

export interface CompIssueResult {
  bookings: { email: string; bookingId: string; status: string }[];
  remaining: number | null;
}

/**
 * Phát vé mời COMP (issue_comp_tickets). Idempotency key phải dài ít nhất 8 ký tự và khác nhau
 * cho mỗi lần phát, nên trang sinh key mới cho mỗi lần bấm.
 */
export function useIssueCompTickets(orgId: string | null, sessionId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      ticketTypeId,
      recipients,
      idempotencyKey,
    }: {
      ticketTypeId: string;
      recipients: CompRecipientInput[];
      idempotencyKey: string;
    }) =>
      api.post<CompIssueResult>(`/api/sessions/${sessionId}/comp-tickets`, {
        ticketTypeId,
        recipients,
        idempotencyKey,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['org', orgId, 'comp-tickets'] });
      void client.invalidateQueries({ queryKey: ['org', orgId, 'orders'] });
    },
  });
}
