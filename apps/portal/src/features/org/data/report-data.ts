import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

// Phản ánh & tranh chấp (dispute cases) và yêu cầu hoàn tiền (refunds) của Org.
//
// Tranh chấp: Org xem được case của mình và gửi giải trình (add_dispute_message) — RLS cho
// OWNER / EVENT_MANAGER. Yêu cầu hoàn tiền: Org chỉ xem được (RLS qua can_view_booking); việc
// duyệt hoàn tiền là của FINANCE_ADMIN nền tảng nên không có thao tác duyệt phía Org.

export interface DisputeMessage {
  id: string;
  authorId: string;
  authorSide: 'ORG' | 'ADMIN';
  body: string;
  attachments: unknown;
  createdAt: string;
}

export interface DisputeReport {
  id: string;
  ticketId: string;
  category: string;
  description: string;
  status: string;
  createdAt: string;
}

export interface DisputeSession {
  id: string;
  title: string | null;
  startsAt: string;
  event: { id: string; title: string } | null;
}

export interface DisputeCase {
  id: string;
  orgId: string;
  sessionId: string;
  status: string;
  reportCount: number;
  thresholdReachedAt: string | null;
  assignedAdminId: string | null;
  orgResponseDueAt: string | null;
  resolution: string | null;
  refundPercentBp: number | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  session: DisputeSession | null;
  messages?: DisputeMessage[];
  reports?: DisputeReport[];
}

export interface Refund {
  id: string;
  bookingId: string;
  amount: number;
  reason: string;
  sourceType: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  succeededAt: string | null;
}

export const DISPUTE_STATUS: Record<string, { label: string; badge: string }> = {
  OPEN: { label: 'Cần giải trình', badge: 'badge-warning' },
  AWAITING_ORG: { label: 'Chờ Org phản hồi', badge: 'badge-warning' },
  UNDER_REVIEW: { label: 'Đã gửi giải trình', badge: 'badge-info' },
  RESOLVED: { label: 'Đã xử lý', badge: 'badge-success' },
  DISMISSED: { label: 'Đã bác bỏ', badge: 'badge-info' },
  APPEALED: { label: 'Đang khiếu nại', badge: 'badge-warning' },
};

export const DISPUTE_RESOLUTION: Record<string, string> = {
  FULL_REFUND: 'Hoàn toàn bộ',
  PARTIAL_REFUND: 'Hoàn một phần',
  NO_ACTION: 'Không hoàn',
};

export const DISPUTE_REPORT_CATEGORY: Record<string, string> = {
  NOT_AS_DESCRIBED: 'Không đúng mô tả',
  EVENT_NOT_HELD: 'Sự kiện không diễn ra',
  ENTRY_DENIED: 'Bị từ chối vào cổng',
  SAFETY: 'An toàn',
  SEAT_ISSUE: 'Vấn đề chỗ ngồi',
  OTHER: 'Khác',
};

export const REFUND_STATUS: Record<string, { label: string; badge: string }> = {
  REQUESTED: { label: 'Chờ xử lý', badge: 'badge-warning' },
  PROCESSING: { label: 'Đang hoàn tiền', badge: 'badge-info' },
  SUCCEEDED: { label: 'Đã hoàn tiền', badge: 'badge-success' },
  FAILED: { label: 'Hoàn tiền thất bại', badge: 'badge-danger' },
  AWAITING_BANK_INFO: { label: 'Chờ thông tin ngân hàng', badge: 'badge-warning' },
  MANUAL_TRANSFER: { label: 'Chuyển khoản thủ công', badge: 'badge-warning' },
};

export const REFUND_REASON: Record<string, string> = {
  SESSION_CANCELLED: 'Suất diễn bị hủy',
  LATE_PAYMENT_NO_SEAT: 'Thanh toán muộn, hết ghế',
  DISPUTE: 'Theo kết luận tranh chấp',
  MANUAL: 'Admin hoàn thủ công',
  DUPLICATE_PAYMENT: 'Thanh toán trùng',
  CUSTOMER_REQUEST: 'Khách yêu cầu hoàn',
};

/** Tranh chấp của Org, mới nhất trước. RLS giới hạn theo vai trò nên không cần lọc orgId. */
export function useOrgDisputes(orgId: string | null, status?: string) {
  return useQuery({
    queryKey: ['org', orgId, 'disputes', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '50', offset: '0' });
      if (status) search.set('status', status);
      return api.get<DisputeCase[]>(`/api/disputes?${search.toString()}`);
    },
    enabled: !!orgId,
  });
}

/** Chi tiết một tranh chấp: hội thoại và các phản ánh gốc. */
export function useOrgDispute(id: string | null) {
  return useQuery({
    queryKey: ['dispute', id],
    queryFn: () => api.get<DisputeCase>(`/api/disputes/${id}`),
    enabled: !!id,
  });
}

/** Gửi giải trình của Org cho một tranh chấp (add_dispute_message, author_side = ORG). */
export function useRespondToDispute(orgId: string | null, id: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { body: string; attachments?: unknown }) =>
      api.post<{ id: string }>(`/api/disputes/${id}/messages`, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['dispute', id] });
      void client.invalidateQueries({ queryKey: ['org', orgId, 'disputes'] });
    },
  });
}

/** Yêu cầu hoàn tiền liên quan tới Org. Chỉ đọc — việc duyệt là của nền tảng. */
export function useOrgRefunds(orgId: string | null, status?: string) {
  return useQuery({
    queryKey: ['org', orgId, 'refunds', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '50', offset: '0' });
      if (status) search.set('status', status);
      return api.get<Refund[]>(`/api/refunds?${search.toString()}`);
    },
    enabled: !!orgId,
  });
}
