import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, ShieldCheck } from 'lucide-react';
import { errorMessage, formatDateTime } from '../../lib/api';
import { useSession } from '../../lib/use-session';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaInfoAlert,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import {
  APPROVAL_STATUS,
  APPROVAL_SUBJECT,
  APPROVAL_VOTE,
  useApprovals,
  useVoteApproval,
  type Approval,
} from './data/admin-data';

const ADMIN_APPROVAL_SCREENS: FigmaScreenOption[] = [
  { id: 'a-approvals', label: 'Phiếu phê duyệt kép (Dual Control)' },
  { id: 'a-approval-review', label: 'Chi tiết & biểu quyết phiếu' },
];

const APPROVAL_FILTERS = [
  { value: 'PENDING', label: 'Chờ biểu quyết' },
  { value: 'APPROVED', label: 'Đã thông qua' },
  { value: 'REJECTED', label: 'Đã bác bỏ' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

function StatusBadge({ status }: { status: string }) {
  const meta = APPROVAL_STATUS[status] ?? { label: status, badge: 'badge-info' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

/** Renders the payload as a small key → value list (the RPC stores it as jsonb). */
function PayloadList({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload);
  if (!entries.length) return <span style={{ color: 'var(--muted)' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([key, value]) => (
        <div key={key} style={{ display: 'flex', gap: 10, fontSize: 12.5 }}>
          <span style={{ color: 'var(--muted)', minWidth: 130 }}>{key}</span>
          <span style={{ fontWeight: 600 }}>
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function AdminApprovalsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useSession();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-approvals';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [voteNote, setVoteNote] = useState('');

  const approvals = useApprovals(statusFilter);
  const voteApproval = useVoteApproval();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = approvals.data ?? [];
    if (!needle) return all;
    return all.filter((a) => {
      const label = APPROVAL_SUBJECT[a.subjectType] ?? a.subjectType;
      return `${a.id} ${label} ${a.subjectId}`.toLowerCase().includes(needle);
    });
  }, [approvals.data, search]);

  const selectedApproval: Approval | undefined =
    (approvals.data ?? []).find((a) => a.id === selectedApprovalId) ?? undefined;

  const myId = session?.user.id;
  const myVote = selectedApproval?.votes.find((v) => v.voterId === myId);

  const screenMeta =
    ADMIN_APPROVAL_SCREENS.find((s) => s.id === activeScreen) || ADMIN_APPROVAL_SCREENS[0];

  const runVote = (decision: 'APPROVE' | 'REJECT') => {
    if (!selectedApproval) return;
    voteApproval.mutate(
      { id: selectedApproval.id, decision, note: voteNote.trim() || null },
      {
        onSuccess: (result) => {
          const done = result.status === 'APPROVED' || result.status === 'REJECTED';
          showToast(
            done
              ? `Phiếu đã ${result.status === 'APPROVED' ? 'thông qua' : 'bị bác bỏ'} (${result.approve_votes}/${result.required}).`
              : `Đã ghi phiếu bầu (${result.approve_votes}/${result.required}).`,
            result.status === 'REJECTED' ? 'warning' : 'success',
          );
          setVoteNote('');
          setScreen('a-approvals');
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_APPROVAL_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-approvals — the dual-control queue */}
      {activeScreen === 'a-approvals' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', width: 320 }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)',
                  }}
                />
                <input
                  className="form-input"
                  style={{ paddingLeft: 34 }}
                  placeholder="Tìm theo mã phiếu, nghiệp vụ, đối tượng..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="form-input"
                style={{ width: 200 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {APPROVAL_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                Danh sách phiếu phê duyệt 2 lớp (Dual Control)
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filtered.length} bản ghi</div>
            </div>
            <QueryNotice
              loading={approvals.isPending}
              error={approvals.error}
              onRetry={() => approvals.refetch()}
              empty={approvals.isSuccess && !(approvals.data ?? []).length}
              emptyText="Không có phiếu phê duyệt nào ở trạng thái này."
            />
            {!!filtered.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>MÃ PHIẾU</th>
                      <th>LOẠI NGHIỆP VỤ</th>
                      <th>ĐỐI TƯỢNG</th>
                      <th>SỐ PHIẾU</th>
                      <th>NGÀY TẠO</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 700 }}>{a.id.slice(0, 8)}</td>
                        <td>{APPROVAL_SUBJECT[a.subjectType] ?? a.subjectType}</td>
                        <td style={{ fontSize: 12 }}>{a.subjectId.slice(0, 8)}</td>
                        <td>
                          {a.votes.filter((v) => v.decision === 'APPROVE').length}/{a.requiredVotes}
                        </td>
                        <td>{formatDateTime(a.createdAt)}</td>
                        <td>
                          <StatusBadge status={a.status} />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedApprovalId(a.id);
                              setScreen('a-approval-review');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Ký duyệt →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. a-approval-review — detail + vote */}
      {activeScreen === 'a-approval-review' && (
        <div>
          <QueryNotice
            loading={approvals.isPending}
            error={approvals.error}
            onRetry={() => approvals.refetch()}
            empty={!selectedApproval}
            emptyText="Chọn một phiếu phê duyệt từ danh sách."
          />
          {selectedApproval && (
            <>
              <FigmaNavyContextBanner
                title={APPROVAL_SUBJECT[selectedApproval.subjectType] ?? selectedApproval.subjectType}
                subtitle="Phiếu đang xem · Đúng nghiệp vụ và phạm vi xử lý"
                badge={APPROVAL_STATUS[selectedApproval.status]?.label ?? selectedApproval.status}
              />
              <FigmaContextGrid
                items={[
                  { label: 'Mã phiếu', value: selectedApproval.id.slice(0, 8) },
                  {
                    label: 'Loại nghiệp vụ',
                    value: APPROVAL_SUBJECT[selectedApproval.subjectType] ?? selectedApproval.subjectType,
                  },
                  { label: 'Đối tượng', value: selectedApproval.subjectId },
                  {
                    label: 'Tiến độ biểu quyết',
                    value: `${selectedApproval.votes.filter((v) => v.decision === 'APPROVE').length}/${selectedApproval.requiredVotes} phiếu đồng ý`,
                  },
                ]}
              />

              <div className="card" style={{ padding: 22, marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                  Nội dung phiếu (payload)
                </div>
                <PayloadList payload={selectedApproval.payload} />
              </div>

              <div className="card" style={{ padding: 22, marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                  Phiếu bầu đã ghi nhận
                </div>
                {selectedApproval.votes.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Chưa có phiếu bầu nào.</div>
                )}
                {selectedApproval.votes.map((v) => (
                  <div
                    key={v.voterId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '10px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {v.voterId.slice(0, 8)}
                        {v.voterId === myId ? ' (bạn)' : ''}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {formatDateTime(v.createdAt)}
                        {v.note ? ` · ${v.note}` : ''}
                      </div>
                    </div>
                    <span
                      className={`badge ${v.decision === 'APPROVE' ? 'badge-success' : 'badge-danger'}`}
                      style={{ alignSelf: 'center' }}
                    >
                      {APPROVAL_VOTE[v.decision] ?? v.decision}
                    </span>
                  </div>
                ))}
              </div>

              {selectedApproval.status !== 'PENDING' ? (
                <FigmaInfoAlert tone="info">
                  Phiếu đã ở trạng thái {APPROVAL_STATUS[selectedApproval.status]?.label ?? selectedApproval.status}.
                </FigmaInfoAlert>
              ) : myVote ? (
                <FigmaInfoAlert tone="warning">
                  Bạn đã ghi phiếu “{APPROVAL_VOTE[myVote.decision] ?? myVote.decision}” cho phiếu này; mỗi Admin chỉ
                  biểu quyết một lần.
                </FigmaInfoAlert>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label className="form-label">Ghi chú biểu quyết (tùy chọn)</label>
                    <input
                      className="form-input"
                      value={voteNote}
                      onChange={(e) => setVoteNote(e.target.value)}
                      placeholder="Đã đối chiếu chứng từ và số dư quỹ."
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={voteApproval.isPending}
                      onClick={() => runVote('APPROVE')}
                    >
                      Đồng ý (ký duyệt)
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={voteApproval.isPending}
                      onClick={() => runVote('REJECT')}
                    >
                      Bác bỏ phiếu
                    </button>
                    <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-approvals')}>
                      Quay lại
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Fallback for a stale screen id */}
      {!ADMIN_APPROVAL_SCREENS.some((s) => s.id === activeScreen) && (
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)' }}>
            <ShieldCheck size={18} /> Màn hình không tồn tại.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            onClick={() => setScreen('a-approvals')}
          >
            Về danh sách phiếu
          </button>
        </div>
      )}
    </div>
  );
}
