import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { DisputeCase } from '../../org/data/report-data';

export type { DisputeCase };

// Admin (nền tảng) đọc qua /api/admin/* (RLS giới hạn cho platform member) và ghi qua các RPC
// có kiểm tra vai trò nền tảng + TOTP. Không có orgId: phạm vi do RLS + vai trò quyết định.

export interface AdminOrg {
  id: string;
  name: string;
  slug: string;
  status: string;
  businessType: string;
  taxCode: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  statusReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminKycDocument {
  id: string;
  docType: string;
  storagePath: string;
  createdAt: string;
}

export interface AdminKycSubmission {
  id: string;
  orgId: string;
  status: 'SUBMITTED' | 'APPROVED' | 'NEEDS_INFO' | 'REJECTED';
  legalInfo: Record<string, unknown> | null;
  submittedBy: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  org: Pick<AdminOrg, 'id' | 'name' | 'slug' | 'status'> | null;
  documents: AdminKycDocument[];
}

export interface AdminEvent {
  id: string;
  title: string;
  slug: string;
  status: string;
  summary: string | null;
  coverImageUrl: string | null;
  requiresReview: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  org: Pick<AdminOrg, 'id' | 'name' | 'slug'> | null;
  sessions: { id: string; title: string | null; startsAt: string; endsAt: string; status: string }[];
}

export interface ApprovalVote {
  voterId: string;
  decision: 'APPROVE' | 'REJECT';
  note: string | null;
  createdAt: string;
}

export interface Approval {
  id: string;
  subjectType: string;
  subjectId: string;
  orgId: string | null;
  requiredVotes: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  requestedBy: string;
  payload: Record<string, unknown>;
  createdAt: string;
  decidedAt: string | null;
  votes: ApprovalVote[];
}

export interface AuditLog {
  id: number;
  actorId: string | null;
  actorScope: string | null;
  orgId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  authorId: string;
  authorSide: 'CUSTOMER' | 'SUPPORT';
  body: string;
  createdAt: string;
}

export interface SupportRequest {
  id: string;
  bookingId: string | null;
  orgId: string | null;
  category: string;
  subject: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

/** Trạng thái hồ sơ KYC (dùng chung với kyc_submissions.status). */
export const ADMIN_KYC_STATUS: Record<string, { label: string; badge: string }> = {
  SUBMITTED: { label: 'Chờ duyệt', badge: 'badge-warning' },
  APPROVED: { label: 'Đã duyệt', badge: 'badge-success' },
  NEEDS_INFO: { label: 'Chờ bổ sung', badge: 'badge-warning' },
  REJECTED: { label: 'Từ chối', badge: 'badge-danger' },
};

/** Trạng thái tổ chức trên nền tảng. */
export const ADMIN_ORG_STATUS: Record<string, { label: string; badge: string }> = {
  DRAFT: { label: 'Bản nháp', badge: 'badge-info' },
  PENDING_REVIEW: { label: 'Chờ duyệt KYC', badge: 'badge-warning' },
  APPROVED: { label: 'Đang hoạt động', badge: 'badge-success' },
  NEEDS_INFO: { label: 'Cần bổ sung', badge: 'badge-warning' },
  REJECTED: { label: 'Bị từ chối', badge: 'badge-danger' },
  SUSPENDED: { label: 'Tạm ngưng', badge: 'badge-danger' },
  TERMINATED: { label: 'Đã chấm dứt', badge: 'badge-danger' },
};

/** Trạng thái sự kiện (events.status). */
export const ADMIN_EVENT_STATUS: Record<string, { label: string; badge: string }> = {
  DRAFT: { label: 'Bản nháp', badge: 'badge-info' },
  PENDING_REVIEW: { label: 'Chờ duyệt', badge: 'badge-warning' },
  CHANGES_REQUESTED: { label: 'Yêu cầu sửa', badge: 'badge-warning' },
  APPROVED: { label: 'Đã duyệt', badge: 'badge-success' },
  PUBLISHED: { label: 'Đã phát hành', badge: 'badge-success' },
  REJECTED: { label: 'Bị từ chối', badge: 'badge-danger' },
  CANCELLED: { label: 'Đã hủy', badge: 'badge-danger' },
  COMPLETED: { label: 'Đã kết thúc', badge: 'badge-info' },
};

export const APPROVAL_STATUS: Record<string, { label: string; badge: string }> = {
  PENDING: { label: 'Chờ biểu quyết', badge: 'badge-warning' },
  APPROVED: { label: 'Đã thông qua', badge: 'badge-success' },
  REJECTED: { label: 'Đã bác bỏ', badge: 'badge-danger' },
  EXPIRED: { label: 'Hết hạn', badge: 'badge-info' },
  CANCELLED: { label: 'Đã hủy', badge: 'badge-info' },
};

export const APPROVAL_VOTE: Record<string, string> = { APPROVE: 'Đồng ý', REJECT: 'Bác bỏ' };

/** Loại nghiệp vụ của phiếu phê duyệt (approvals.subject_type). */
export const APPROVAL_SUBJECT: Record<string, string> = {
  SESSION_CANCELLATION: 'Hủy suất diễn & hoàn tiền',
  PAYOUT: 'Chi trả (Payout)',
  REFUND_MANUAL: 'Hoàn tiền thủ công',
  MANUAL_TRANSFER: 'Chuyển khoản thủ công',
  HOLD_RELEASE: 'Giải phóng quỹ tạm giữ',
  ORG_SUSPENSION: 'Đổi trạng thái tổ chức',
};

/** Phạm vi tài khoản thao tác (audit_logs.actor_scope). */
export const AUDIT_SCOPE: Record<string, { label: string; badge: string }> = {
  CUSTOMER: { label: 'Khách hàng', badge: 'badge-info' },
  ORG: { label: 'Tổ chức', badge: 'badge-info' },
  STAFF: { label: 'Nhân sự', badge: 'badge-info' },
  ADMIN: { label: 'Admin nền tảng', badge: 'badge-warning' },
  SYSTEM: { label: 'Hệ thống', badge: 'badge-info' },
};

/** Trạng thái phiếu hỗ trợ (support_requests.status). */
export const SUPPORT_STATUS: Record<string, { label: string; badge: string }> = {
  OPEN: { label: 'Mới', badge: 'badge-warning' },
  IN_PROGRESS: { label: 'Đang xử lý', badge: 'badge-info' },
  WAITING_CUSTOMER: { label: 'Chờ khách phản hồi', badge: 'badge-warning' },
  RESOLVED: { label: 'Đã xử lý', badge: 'badge-success' },
  CLOSED: { label: 'Đã đóng', badge: 'badge-info' },
};

/** Chủ đề phiếu hỗ trợ (support_requests.category). */
export const SUPPORT_CATEGORY: Record<string, string> = {
  PAYMENT: 'Thanh toán',
  TICKET: 'Vé',
  REFUND: 'Hoàn tiền',
  ACCOUNT: 'Tài khoản',
  APP_BUG: 'Lỗi ứng dụng',
  OTHER: 'Khác',
};

/** Hồ sơ KYC của các tổ chức. Mặc định trả về tất cả trạng thái. */
export function useAdminKyc(status?: string) {
  return useQuery({
    queryKey: ['admin', 'kyc', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (status) search.set('status', status);
      return api.get<AdminKycSubmission[]>(`/api/admin/kyc-submissions?${search.toString()}`);
    },
  });
}

/** Duyệt hồ sơ KYC (review_kyc). APPROVED/NEEDS_INFO/REJECTED; cần KYC_REVIEWER + TOTP. */
export function useReviewKyc() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: string; note?: string | null }) =>
      api.post(`/api/admin/kyc-submissions/${id}/review`, { decision, note: note ?? null }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'kyc'] });
      client.invalidateQueries({ queryKey: ['admin', 'orgs'] });
    },
  });
}

/** Tổ chức trên nền tảng, lọc theo trạng thái / tên. */
export function useAdminOrgs(status?: string, q?: string) {
  return useQuery({
    queryKey: ['admin', 'orgs', status ?? null, q ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (status) search.set('status', status);
      if (q) search.set('q', q);
      return api.get<AdminOrg[]>(`/api/admin/organizations?${search.toString()}`);
    },
  });
}

/** Mở yêu cầu đổi trạng thái tổ chức (request_org_status_change) — cần hai người duyệt. */
export function useRequestOrgStatusChange() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: string; reason: string }) =>
      api.post<{ approval_id: string }>(`/api/admin/organizations/${id}/status-change`, { action, reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'approvals'] }),
  });
}

/** Sự kiện chờ duyệt (hoặc theo trạng thái) trên toàn nền tảng. */
export function useAdminEvents(status?: string) {
  return useQuery({
    queryKey: ['admin', 'events', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (status) search.set('status', status);
      return api.get<AdminEvent[]>(`/api/admin/events?${search.toString()}`);
    },
  });
}

/** Duyệt sự kiện (review_event). APPROVED/REJECTED/CHANGES_REQUESTED; cần vai trò + TOTP. */
export function useReviewEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: string; note?: string | null }) =>
      api.post(`/api/admin/events/${id}/review`, { decision, note: note ?? null }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'events'] }),
  });
}

/** Hàng đợi biểu quyết hai người. Mặc định PENDING. */
export function useApprovals(status?: string, subjectType?: string) {
  return useQuery({
    queryKey: ['admin', 'approvals', status ?? null, subjectType ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (status) search.set('status', status);
      if (subjectType) search.set('subjectType', subjectType);
      return api.get<Approval[]>(`/api/admin/approvals?${search.toString()}`);
    },
  });
}

/** Một phiếu phê duyệt kèm các phiếu bầu. */
export function useApproval(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'approval', id],
    queryFn: () => api.get<Approval>(`/api/admin/approvals/${id}`),
    enabled: !!id,
  });
}

/** Biểu quyết một approval (vote_approval). Trả về tiến độ { status, approve_votes, required }. */
export function useVoteApproval() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'APPROVE' | 'REJECT'; note?: string | null }) =>
      api.post<{ status: string; approve_votes: number; required: number }>(
        `/api/admin/approvals/${id}/votes`,
        { decision, note: note ?? null },
      ),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'approvals'] });
      client.invalidateQueries({ queryKey: ['admin', 'approval'] });
    },
  });
}

/** Lịch sử thao tác (audit_logs), lọc theo tổ chức / hành động / đối tượng. */
export function useAuditLogs(filters: { orgId?: string; action?: string; targetType?: string; targetId?: string }) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', filters],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (filters.orgId) search.set('orgId', filters.orgId);
      if (filters.action) search.set('action', filters.action);
      if (filters.targetType) search.set('targetType', filters.targetType);
      if (filters.targetId) search.set('targetId', filters.targetId);
      return api.get<AuditLog[]>(`/api/admin/audit-logs?${search.toString()}`);
    },
  });
}

// Tranh chấp (dispute_cases) dưới góc nhìn Admin: RLS cho DISPUTE_ADMIN thấy toàn bộ case nên chỉ
// đọc qua /api/disputes (không truyền orgId). Việc phán quyết là RPC resolve_dispute_case
// (DISPUTE_ADMIN + TOTP) và trả về số yêu cầu hoàn tiền đã tạo.

/** Hàng đợi tranh chấp toàn nền tảng, lọc theo trạng thái. */
export function useAdminDisputes(status?: string) {
  return useQuery({
    queryKey: ['admin', 'disputes', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (status) search.set('status', status);
      return api.get<DisputeCase[]>(`/api/disputes?${search.toString()}`);
    },
  });
}

/** Chi tiết một tranh chấp: hội thoại giải trình và các phản ánh gốc. */
export function useAdminDispute(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'dispute', id],
    queryFn: () => api.get<DisputeCase>(`/api/disputes/${id}`),
    enabled: !!id,
  });
}

/** Phán quyết tranh chấp (resolve_dispute_case). Cần DISPUTE_ADMIN + TOTP. */
export function useResolveDispute() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      resolution,
      refundPercentBp,
      scope,
      note,
    }: {
      id: string;
      resolution: 'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_ACTION';
      refundPercentBp?: number | null;
      scope?: 'REPORTERS' | 'ALL_TICKETS';
      note?: string | null;
    }) =>
      api.post<{ refunds_created: number }>(`/api/admin/disputes/${id}/resolve`, {
        resolution,
        refundPercentBp: refundPercentBp ?? null,
        scope: scope ?? 'REPORTERS',
        note: note ?? null,
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'disputes'] });
      client.invalidateQueries({ queryKey: ['admin', 'dispute'] });
    },
  });
}

// Phiếu hỗ trợ (support_requests): RLS cho vai trò nền tảng SUPPORT thấy toàn bộ, người dùng thấy
// phiếu của mình. Admin trả lời qua add_support_message (author_side = SUPPORT) — hệ thống tự
// chuyển trạng thái sang WAITING_CUSTOMER và gán assigned_to.

/** Hàng đợi phiếu hỗ trợ (kèm hội thoại). */
export function useAdminSupportRequests() {
  return useQuery({
    queryKey: ['admin', 'support-requests'],
    queryFn: () => api.get<SupportRequest[]>('/api/support-requests?limit=100&offset=0'),
  });
}

/** Gửi phản hồi hỗ trợ (add_support_message). Cần vai trò nền tảng SUPPORT. */
export function useReplySupportRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api.post<{ id: string }>(`/api/support-requests/${id}/messages`, { body }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'support-requests'] }),
  });
}
