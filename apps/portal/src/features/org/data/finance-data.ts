import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

// Tài chính Org: tổng quan quỹ, kỳ đối soát, lệnh chi trả và tài khoản ngân hàng nhận tiền.

/** Tổng quan quỹ (get_org_finance_summary). Số tiền là VND, đơn vị đồng. */
export interface FinanceSummary {
  ledgerBalance: number;
  held: number;
  ready: number;
  paidOut: number;
  inProgress: number;
  activeHolds: FundHold[];
  negativeBalanceSince: string | null;
}

export interface FundHold {
  id: string;
  scope: string;
  sessionId: string | null;
  reason: string | null;
  createdAt: string;
}

export interface Settlement {
  id: string;
  sessionId: string;
  status: string;
  cutoffAt: string | null;
  grossAmount: number;
  refundAmount: number;
  chargebackAmount: number;
  feeAmount: number;
  netAmount: number;
  computedAt: string | null;
  createdAt: string;
  session: { id: string; title: string | null; startsAt: string } | null;
}

export interface Payout {
  id: string;
  tenantId: string;
  bankAccountId: string;
  amount: number;
  status: string;
  failureReason: string | null;
  sentAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
}

export interface OrgBankAccount {
  id: string;
  orgId: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  status: string;
  effectiveAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export const SETTLEMENT_STATUS: Record<string, { label: string; badge: string }> = {
  OPEN: { label: 'Đang tích lũy', badge: 'badge-info' },
  ON_HOLD: { label: 'Tạm giữ (tranh chấp)', badge: 'badge-warning' },
  READY: { label: 'Sẵn sàng chi trả', badge: 'badge-success' },
  PAID_OUT: { label: 'Đã chi trả', badge: 'badge-success' },
  CLOSED: { label: 'Đã chốt sổ', badge: 'badge-info' },
};

export const PAYOUT_STATUS: Record<string, { label: string; badge: string }> = {
  PROPOSED: { label: 'Chờ Admin duyệt', badge: 'badge-warning' },
  APPROVED: { label: 'Đã duyệt, chờ chuyển', badge: 'badge-warning' },
  SENT: { label: 'Đã chuyển khoản', badge: 'badge-info' },
  CONFIRMED: { label: 'Thành công', badge: 'badge-success' },
  FAILED: { label: 'Thất bại', badge: 'badge-danger' },
  CANCELLED: { label: 'Đã hủy', badge: 'badge-danger' },
};

export const BANK_ACCOUNT_STATUS: Record<string, { label: string; badge: string }> = {
  PENDING: { label: 'Chờ Admin duyệt', badge: 'badge-warning' },
  ACTIVE: { label: 'Đang sử dụng', badge: 'badge-success' },
  RETIRED: { label: 'Đã ngừng dùng', badge: 'badge-info' },
  REJECTED: { label: 'Bị từ chối', badge: 'badge-danger' },
};

/** Tổng quan quỹ của Org (OWNER / FINANCE). */
export function useOrgFinance(orgId: string | null) {
  return useQuery({
    queryKey: ['org', orgId, 'finance'],
    queryFn: () => api.get<FinanceSummary>(`/api/organizations/${orgId}/finance`),
    enabled: !!orgId,
  });
}

/** Kỳ đối soát doanh thu theo suất diễn, mới nhất trước. */
export function useOrgSettlements(orgId: string | null, limit = 50) {
  return useQuery({
    queryKey: ['org', orgId, 'settlements', limit],
    queryFn: () =>
      api.get<Settlement[]>(`/api/organizations/${orgId}/settlements?limit=${limit}&offset=0`),
    enabled: !!orgId,
  });
}

/** Lệnh chi trả về tài khoản Org. */
export function useOrgPayouts(orgId: string | null, status?: string) {
  return useQuery({
    queryKey: ['org', orgId, 'payouts', status ?? null],
    queryFn: () => {
      const search = new URLSearchParams({ limit: '50', offset: '0' });
      if (status) search.set('status', status);
      return api.get<Payout[]>(`/api/organizations/${orgId}/payouts?${search.toString()}`);
    },
    enabled: !!orgId,
  });
}

/** Tài khoản ngân hàng nhận tiền của Org, kể cả bản chờ duyệt. */
export function useOrgBankAccounts(orgId: string | null) {
  return useQuery({
    queryKey: ['org', orgId, 'bank-accounts'],
    queryFn: () => api.get<OrgBankAccount[]>(`/api/organizations/${orgId}/bank-accounts`),
    enabled: !!orgId,
  });
}

/**
 * Gửi yêu cầu đổi tài khoản nhận tiền (request_bank_account_change). Bản mới ở trạng thái
 * PENDING chờ FINANCE_ADMIN duyệt; OWNER phải bật 2FA nên lỗi MFA_REQUIRED là bình thường.
 */
export function useRequestBankAccount(orgId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { bankCode: string; accountNumber: string; accountHolder: string }) =>
      api.post<{ id: string }>(`/api/organizations/${orgId}/bank-accounts`, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['org', orgId, 'bank-accounts'] });
    },
  });
}
