import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

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
  decision: string;
  note: string | null;
  createdAt: string;
}

export interface Approval {
  id: string;
  subjectType: string;
  subjectId: string;
  action: string;
  status: string;
  requestedBy: string;
  summary: Record<string, unknown> | null;
  expiresAt: string | null;
  createdAt: string;
  decidedAt: string | null;
  votes: ApprovalVote[];
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  orgId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
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

/** Biểu quyết một approval (vote_approval). Trả về tiến độ { status, approve_votes, required }. */
export function useVoteApproval() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, note }: { id: string; decision: string; note?: string | null }) =>
      api.post<{ status: string; approve_votes: number; required: number }>(
        `/api/admin/approvals/${id}/votes`,
        { decision, note: note ?? null },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ['admin', 'approvals'] }),
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
