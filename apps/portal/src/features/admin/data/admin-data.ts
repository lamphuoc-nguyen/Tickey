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
      api.post<{ approvalId: string }>(`/api/admin/organizations/${id}/status-change`, { action, reason }),
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

/** Link ký tạm thời tới một tệp KYC riêng tư (kyc-private), chỉ KYC_REVIEWER / OWNER đọc được. */
export async function kycDocumentUrl(path: string): Promise<string> {
  const access = await api.post<{ url: string; expiresAt: string }>('/api/uploads/access', { purpose: 'KYC', path });
  return access.url;
}

/** Biểu quyết một approval (vote_approval). Trả về tiến độ { status, approveVotes, required } (camelCase via mapDatabaseJson). */
export function useVoteApproval() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'APPROVE' | 'REJECT'; note?: string | null }) =>
      api.post<{ status: string; approveVotes: number; required: number }>(
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
      api.post<{ refundsCreated: number }>(`/api/admin/disputes/${id}/resolve`, {
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

// ---------------------------------------------------------------------------------------------
// Tiền tệ nền tảng: hoàn tiền khách hàng, chargeback, giải ngân cho Org, xác minh ngân hàng và
// đối soát. Đọc qua /api/admin/* (RLS cho FINANCE_ADMIN / DISPUTE_ADMIN), ghi qua các RPC có kiểm
// tra vai trò + TOTP. Không có orgId: phạm vi do RLS quyết định.
// ---------------------------------------------------------------------------------------------

export interface AdminRefund {
  id: string;
  orgId: string;
  bookingId: string;
  paymentId: string | null;
  amount: number;
  reason: string;
  sourceType: string | null;
  sourceId: string | null;
  status: string;
  gatewayRefundId: string | null;
  attempts: number;
  lastError: string | null;
  approvalId: string | null;
  requestedBy: string | null;
  createdAt: string;
  updatedAt: string;
  succeededAt: string | null;
}

/** Đích nhận tiền hoàn do khách khai báo (chỉ FINANCE_ADMIN đọc được). */
export interface RefundBankInfo {
  refundId: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  otpVerifiedAt: string | null;
  transferredAt: string | null;
  transferRef: string | null;
}

export interface Chargeback {
  id: string;
  orgId: string;
  paymentId: string;
  bookingId: string;
  gatewayCaseId: string | null;
  amount: number;
  reason: string | null;
  status: string;
  recordedBy: string;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminPayout {
  id: string;
  tenantId: string;
  bankAccountId: string;
  amount: number;
  status: string;
  approvalId: string | null;
  gatewayPayoutRef: string | null;
  proposedBy: string | null;
  failureReason: string | null;
  sentAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  org?: AdminOrgRef | null;
}

export interface AdminOrgRef {
  id: string;
  name: string;
  slug: string;
}

export interface AdminBankAccount {
  id: string;
  orgId: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  status: string;
  effectiveAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
  org?: AdminOrgRef | null;
}

export interface AdminSettlement {
  id: string;
  tenantId: string;
  sessionId: string;
  status: string;
  cutoffAt: string | null;
  grossAmount: number;
  refundAmount: number;
  chargebackAmount: number;
  feeAmount: number;
  netAmount: number;
  report: Record<string, unknown>;
  computedAt: string | null;
  createdAt: string;
  updatedAt: string;
  session?: {
    id: string;
    title: string | null;
    startsAt: string;
    event?: { id: string; title: string } | null;
  } | null;
}

export interface GatewayStatementLine {
  id: string;
  gateway: string;
  statementDate: string;
  txnType: 'PAYMENT' | 'REFUND' | 'PAYOUT' | 'CHARGEBACK';
  gatewayTxnId: string;
  amount: number;
  paymentId: string | null;
  refundId: string | null;
  matchStatus: string;
  raw: unknown;
  importedAt: string;
}

/** Trạng thái hồ sơ chargeback (chargebacks.status). */
export const CHARGEBACK_STATUS: Record<string, { label: string; badge: string }> = {
  OPEN: { label: 'Đang kháng nghị', badge: 'badge-warning' },
  WON: { label: 'Thắng kháng nghị', badge: 'badge-success' },
  LOST: { label: 'Thua kháng nghị', badge: 'badge-danger' },
  ACCEPTED: { label: 'Chấp nhận bồi hoàn', badge: 'badge-danger' },
};

/** Kết quả đối chiếu sao kê cổng thanh toán (gateway_statement_lines.match_status). */
export const GATEWAY_MATCH_STATUS: Record<string, { label: string; badge: string }> = {
  UNMATCHED: { label: 'Chưa đối chiếu', badge: 'badge-info' },
  MATCHED: { label: 'Khớp', badge: 'badge-success' },
  MISSING_IN_SYSTEM: { label: 'Có ở cổng, thiếu ở hệ thống', badge: 'badge-danger' },
  AMOUNT_MISMATCH: { label: 'Sai lệch số tiền', badge: 'badge-warning' },
};

/** Loại giao dịch trên sao kê cổng thanh toán. */
export const GATEWAY_TXN_TYPE: Record<string, string> = {
  PAYMENT: 'Thu tiền',
  REFUND: 'Hoàn tiền',
  PAYOUT: 'Giải ngân',
  CHARGEBACK: 'Bồi hoàn thẻ',
};

/** Danh sách lệnh hoàn tiền toàn nền tảng, lọc theo trạng thái. */
export function useAdminRefunds(status?: string) {
  return useQuery({
    queryKey: ['admin', 'refunds', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (status) search.set('status', status);
      return api.get<AdminRefund[]>(`/api/admin/refunds?${search.toString()}`);
    },
  });
}

/** Thông tin ngân hàng nhận tiền hoàn của khách (null khi khách chưa khai báo). */
export function useRefundBankInfo(refundId: string | null) {
  return useQuery({
    queryKey: ['admin', 'refund-bank-info', refundId],
    queryFn: () => api.get<RefundBankInfo | null>(`/api/admin/refunds/${refundId}/bank-info`),
    enabled: !!refundId,
  });
}

/** Tạo lệnh hoàn thủ công (create_manual_refund). Trên ngưỡng sẽ thành phiếu duyệt kép. */
export function useCreateManualRefund() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { bookingId: string; amount: number; note: string; ticketIds?: string[] | null }) =>
      api.post<{ refundId?: string; approvalId?: string; status: string }>('/api/admin/refunds', {
        bookingId: body.bookingId,
        amount: body.amount,
        note: body.note,
        ticketIds: body.ticketIds ?? null,
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'refunds'] }),
  });
}

/** Ghi nhận đã chuyển khoản hoàn tiền thủ công (confirm_manual_transfer). */
export function useManualTransfer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, transferRef }: { id: string; transferRef: string }) =>
      api.post<void>(`/api/admin/refunds/${id}/manual-transfer`, { transferRef }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'refunds'] });
      client.invalidateQueries({ queryKey: ['admin', 'refund-bank-info'] });
    },
  });
}

/** Thử lại hoặc yêu cầu bổ sung thông tin ngân hàng (admin_refund_action). */
export function useRefundAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'RETRY' | 'REQUEST_BANK_INFO' }) =>
      api.post<{ status: string }>(`/api/admin/refunds/${id}/actions`, { action }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'refunds'] }),
  });
}

/** Hồ sơ chargeback toàn nền tảng, lọc theo trạng thái. */
export function useAdminChargebacks(status?: string) {
  return useQuery({
    queryKey: ['admin', 'chargebacks', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (status) search.set('status', status);
      return api.get<Chargeback[]>(`/api/admin/chargebacks?${search.toString()}`);
    },
  });
}

/** Kết luận kháng nghị chargeback (resolve_chargeback). Cần FINANCE_ADMIN. */
export function useResolveChargeback() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, outcome, note }: { id: string; outcome: 'WON' | 'LOST' | 'ACCEPTED'; note?: string | null }) =>
      api.post<void>(`/api/admin/chargebacks/${id}/resolve`, { outcome, note: note ?? null }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'chargebacks'] }),
  });
}

/** Lệnh giải ngân toàn nền tảng, lọc theo trạng thái. */
export function useAdminPayouts(status?: string) {
  return useQuery({
    queryKey: ['admin', 'payouts', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (status) search.set('status', status);
      return api.get<AdminPayout[]>(`/api/admin/payouts?${search.toString()}`);
    },
  });
}

/** Hủy / tạm hoãn lệnh giải ngân (cancel_payout). */
export function useCancelPayout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<void>(`/api/admin/payouts/${id}/cancel`, { reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'payouts'] }),
  });
}

/** Đề xuất giải ngân số dư READY của Org (propose_payout → phiếu duyệt kép). */
export function useProposePayout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) =>
      api.post<{ payoutId: string; approvalId: string; amount: number }>('/api/admin/payouts', { orgId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'payouts'] }),
  });
}

/** Tài khoản ngân hàng của Org, mặc định chỉ bản PENDING cần duyệt. */
export function useAdminBankAccounts(status?: string) {
  return useQuery({
    queryKey: ['admin', 'bank-accounts', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (status) search.set('status', status);
      return api.get<AdminBankAccount[]>(`/api/admin/bank-accounts?${search.toString()}`);
    },
  });
}

/** Duyệt / từ chối tài khoản ngân hàng nhận tiền (review_bank_account). */
export function useReviewBankAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: 'APPROVE' | 'REJECT'; note?: string | null }) =>
      api.post<void>(`/api/admin/bank-accounts/${id}/review`, { decision, note: note ?? null }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'bank-accounts'] }),
  });
}

/** Kỳ đối soát doanh thu toàn nền tảng. */
export function useAdminSettlements(filters: { orgId?: string; status?: string }) {
  return useQuery({
    queryKey: ['admin', 'settlements', filters],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (filters.orgId) search.set('orgId', filters.orgId);
      if (filters.status) search.set('status', filters.status);
      return api.get<AdminSettlement[]>(`/api/admin/settlements?${search.toString()}`);
    },
  });
}

/** Tính lại kỳ đối soát của một suất diễn (recompute_settlement). */
export function useRecomputeSettlement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      api.post<Record<string, unknown>>(`/api/admin/sessions/${sessionId}/settlement`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'settlements'] });
      client.invalidateQueries({ queryKey: ['org'] });
    },
  });
}

/** Dòng sao kê cổng thanh toán đã nhập, kèm trạng thái đối chiếu. */
export function useGatewayStatements(filters: { gateway?: string; date?: string }) {
  return useQuery({
    queryKey: ['admin', 'gateway-statements', filters],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '100', offset: '0' });
      if (filters.gateway) search.set('gateway', filters.gateway);
      if (filters.date) search.set('date', filters.date);
      return api.get<GatewayStatementLine[]>(`/api/admin/gateway-statements?${search.toString()}`);
    },
  });
}

/** Nhập sao kê cổng thanh toán (import_gateway_statement). Trả về { matched, mismatches }. */
export function useImportGatewayStatement() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      gateway: string;
      statementDate: string;
      lines: { txnType: string; gatewayTxnId: string; amount: number; raw: unknown }[];
    }) => api.post<{ matched: number; mismatches: number }>('/api/admin/gateway-statements', body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['admin', 'gateway-statements'] });
      client.invalidateQueries({ queryKey: ['admin', 'settlements'] });
    },
  });
}
