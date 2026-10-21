import { useMemo, useState } from 'react';
import { useOrgEvents, useOrganization, type OrgEvent, type OrgSession } from './org-data';
import { useOrgFinance } from './finance-data';
import { useOrgDisputes, useOrgRefunds } from './report-data';

// Tổng quan Org: ghép các hook đã có (tổ chức, quỹ, sự kiện/suất diễn, tranh chấp, hoàn tiền)
// thành một khung số liệu cho trang chủ. Không có endpoint tổng hợp riêng nên trang tự tính.

/** Suất diễn sắp diễn (startsAt ở tương lai), sớm nhất trước. */
export interface UpcomingSession {
  session: OrgSession;
  event: Pick<OrgEvent, 'id' | 'title' | 'coverImageUrl'>;
}

/** Một việc Org cần xử lý trên trang chủ. */
export interface TodoItem {
  id: string;
  title: string;
  details: string;
  status: string;
  badge: string;
  /** Đường dẫn điều hướng khi bấm vào dòng. */
  to: string;
}

export interface OrgHome {
  org: ReturnType<typeof useOrganization>;
  finance: ReturnType<typeof useOrgFinance>;
  events: ReturnType<typeof useOrgEvents>;
  disputes: ReturnType<typeof useOrgDisputes>;
  refunds: ReturnType<typeof useOrgRefunds>;
  upcoming: UpcomingSession[];
  todos: TodoItem[];
  isPending: boolean;
  error: unknown;
  refetch: () => Promise<unknown>;
}

const REFUND_NEEDS_ACTION = new Set(['REQUESTED', 'PROCESSING', 'AWAITING_BANK_INFO']);

/** Số liệu và danh sách việc cần xử lý của trang Tổng quan tổ chức. */
export function useOrgHome(orgId: string | null): OrgHome {
  const org = useOrganization(orgId);
  const finance = useOrgFinance(orgId);
  const events = useOrgEvents(orgId);
  const disputes = useOrgDisputes(orgId);
  const refunds = useOrgRefunds(orgId);
  // A stable "now", captured once when the page mounts (kept out of render on purpose).
  const [mountedAt] = useState(() => Date.now());

  const upcoming = useMemo(
    () =>
      (events.data ?? [])
        .flatMap((event) =>
          event.sessions
            .filter((session) => new Date(session.startsAt).getTime() > mountedAt)
            .map((session) => ({ session, event })),
        )
        .sort((a, b) => new Date(a.session.startsAt).getTime() - new Date(b.session.startsAt).getTime()),
    [events.data, mountedAt],
  );

  const todos = useMemo(() => {
    const items: TodoItem[] = [];
    for (const dispute of disputes.data ?? []) {
      if (dispute.status !== 'OPEN' && dispute.status !== 'AWAITING_ORG') continue;
      const label = dispute.session?.event?.title ?? dispute.session?.title ?? 'Suất diễn';
      items.push({
        id: `dispute-${dispute.id}`,
        title: `Tranh chấp · ${label}`,
        details: `${dispute.reportCount} phản ánh cần giải trình`,
        status: dispute.status === 'OPEN' ? 'Cần giải trình' : 'Chờ Org phản hồi',
        badge: 'badge-warning',
        to: `/org/reports?screen=o-dispute-detail&id=${dispute.id}`,
      });
    }
    for (const refund of refunds.data ?? []) {
      if (!REFUND_NEEDS_ACTION.has(refund.status)) continue;
      items.push({
        id: `refund-${refund.id}`,
        title: `Yêu cầu hoàn tiền ${refund.id.slice(0, 8)}`,
        details: `${refund.amount.toLocaleString('vi-VN')}đ · ${refund.reason}`,
        status: 'Đang xử lý',
        badge: 'badge-info',
        to: '/org/reports?screen=o-refunds',
      });
    }
    return items;
  }, [disputes.data, refunds.data]);

  return {
    org,
    finance,
    events,
    disputes,
    refunds,
    upcoming,
    todos,
    isPending: org.isPending || finance.isPending || events.isPending,
    error: org.error || finance.error || events.error || disputes.error || refunds.error,
    refetch: () =>
      Promise.all([org.refetch(), finance.refetch(), events.refetch(), disputes.refetch(), refunds.refetch()]),
  };
}
