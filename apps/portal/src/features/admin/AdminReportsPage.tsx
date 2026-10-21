import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Scale, Search } from 'lucide-react';
import { errorMessage, formatDateTime } from '../../lib/api';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaInfoAlert,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import {
  DISPUTE_REPORT_CATEGORY,
  DISPUTE_RESOLUTION,
  DISPUTE_STATUS,
} from '../org/data/report-data';
import {
  SUPPORT_CATEGORY,
  SUPPORT_STATUS,
  useAdminDispute,
  useAdminDisputes,
  useAdminSupportRequests,
  useReplySupportRequest,
  useResolveDispute,
  type DisputeCase,
  type SupportRequest,
} from './data/admin-data';

const ADMIN_REPORT_SCREENS: FigmaScreenOption[] = [
  { id: 'a-reports', label: 'Phản ánh & tranh chấp khách hàng' },
  { id: 'a-dispute', label: 'Chi tiết & phán quyết tranh chấp' },
  { id: 'a-dispute-resolve', label: 'Phán quyết tranh chấp' },
  { id: 'a-support', label: 'Phiếu hỗ trợ kỹ thuật (Support Tickets)' },
  { id: 'a-support-detail', label: 'Chi tiết & phản hồi phiếu hỗ trợ' },
];

const DISPUTE_FILTERS = [
  { value: 'OPEN', label: 'Cần giải trình' },
  { value: 'AWAITING_ORG', label: 'Chờ Org phản hồi' },
  { value: 'UNDER_REVIEW', label: 'Đã gửi giải trình' },
  { value: 'RESOLVED', label: 'Đã xử lý' },
  { value: 'DISMISSED', label: 'Đã bác bỏ' },
  { value: 'APPEALED', label: 'Đang khiếu nại' },
];

/** Percent (basis points) → a whole percent for display. */
const bpToPercent = (bp: number | null) => (bp == null ? '—' : `${(bp / 100).toFixed(bp % 100 === 0 ? 0 : 1)}%`);

function StatusBadge({ status }: { status: string }) {
  const meta = DISPUTE_STATUS[status] ?? { label: status, badge: 'badge-info' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

export function AdminReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-reports';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const [resolution, setResolution] = useState<'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_ACTION'>('PARTIAL_REFUND');
  const [percent, setPercent] = useState('50');
  const [scope, setScope] = useState<'REPORTERS' | 'ALL_TICKETS'>('REPORTERS');
  const [note, setNote] = useState('');

  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(null);
  const [supportReply, setSupportReply] = useState('');

  const disputes = useAdminDisputes(statusFilter);
  const selected = useAdminDispute(activeScreen === 'a-reports' ? null : selectedCaseId);
  const resolveDispute = useResolveDispute();
  const supportRequests = useAdminSupportRequests();
  const replySupport = useReplySupportRequest();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = disputes.data ?? [];
    if (!needle) return all;
    return all.filter((d) =>
      `${d.id} ${d.session?.event?.title ?? ''} ${d.session?.title ?? ''}`.toLowerCase().includes(needle),
    );
  }, [disputes.data, search]);

  /** The case shown on the detail / resolve screens: prefer the freshly fetched one. */
  const caseData: DisputeCase | undefined =
    selected.data ?? (disputes.data ?? []).find((d) => d.id === selectedCaseId);

  const supportRequest: SupportRequest | undefined = (supportRequests.data ?? []).find(
    (r) => r.id === selectedSupportId,
  );

  const screenMeta =
    ADMIN_REPORT_SCREENS.find((s) => s.id === activeScreen) || ADMIN_REPORT_SCREENS[0];

  const partPercentValue = Number(percent);
  const percentValid =
    resolution !== 'PARTIAL_REFUND' || (Number.isFinite(partPercentValue) && partPercentValue >= 1 && partPercentValue <= 100);

  const runResolve = () => {
    if (!caseData) return;
    resolveDispute.mutate(
      {
        id: caseData.id,
        resolution,
        refundPercentBp: resolution === 'PARTIAL_REFUND' ? Math.round(partPercentValue * 100) : null,
        scope,
        note: note.trim() || null,
      },
      {
        onSuccess: (result) => {
          showToast(
            `Đã ban hành phán quyết (${DISPUTE_RESOLUTION[resolution] ?? resolution}), tạo ${result.refunds_created} yêu cầu hoàn tiền.`,
            'success',
          );
          setNote('');
          setScreen('a-reports');
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
        screens={ADMIN_REPORT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-reports — the dispute queue */}
      {activeScreen === 'a-reports' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
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
                placeholder="Tìm theo mã hồ sơ, sự kiện, suất diễn..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="form-input"
              style={{ width: 210 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {DISPUTE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-support')}
            >
              Phiếu hỗ trợ kỹ thuật
            </button>
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
                Danh sách tranh chấp
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filtered.length} bản ghi</div>
            </div>
            <QueryNotice
              loading={disputes.isPending}
              error={disputes.error}
              onRetry={() => disputes.refetch()}
              empty={disputes.isSuccess && !(disputes.data ?? []).length}
              emptyText="Không có tranh chấp nào ở trạng thái này."
            />
            {!!filtered.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>MÃ HỒ SƠ</th>
                      <th>SỰ KIỆN / SUẤT DIỄN</th>
                      <th>SỐ PHẢN ÁNH</th>
                      <th>HẠN PHẢN HỒI</th>
                      <th>NGÀY TẠO</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 700 }}>{d.id.slice(0, 8)}</td>
                        <td>
                          {d.session?.event?.title ?? d.session?.title ?? '—'}
                          {d.session?.title && d.session?.event?.title ? ` · ${d.session.title}` : ''}
                        </td>
                        <td>{d.reportCount}</td>
                        <td>{d.orgResponseDueAt ? formatDateTime(d.orgResponseDueAt) : '—'}</td>
                        <td>{formatDateTime(d.createdAt)}</td>
                        <td>
                          <StatusBadge status={d.status} />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCaseId(d.id);
                              setScreen('a-dispute');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Xem xét →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <FigmaInfoAlert tone="info">
            Phán quyết có tạo hoàn tiền sẽ được chuyển sang Phê duyệt kép (Dual Control) nếu cần giải phóng quỹ tạm
            giữ.
          </FigmaInfoAlert>
        </div>
      )}

      {/* 2. a-dispute — detail */}
      {activeScreen === 'a-dispute' && (
        <div>
          <QueryNotice
            loading={selected.isPending && !caseData}
            error={selected.error}
            onRetry={() => selected.refetch()}
            empty={!caseData}
            emptyText="Chọn một hồ sơ tranh chấp từ danh sách."
          />
          {caseData && (
            <>
              <FigmaNavyContextBanner
                title={caseData.session?.event?.title ?? 'Tranh chấp'}
                subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
                badge={DISPUTE_STATUS[caseData.status]?.label ?? caseData.status}
              />
              <FigmaContextGrid
                items={[
                  { label: 'Mã hồ sơ', value: caseData.id },
                  {
                    label: 'Sự kiện / Suất diễn',
                    value: `${caseData.session?.event?.title ?? '—'}${caseData.session?.title ? ` · ${caseData.session.title}` : ''}`,
                  },
                  {
                    label: 'Thời điểm suất diễn',
                    value: caseData.session ? formatDateTime(caseData.session.startsAt) : '—',
                  },
                  { label: 'Số phản ánh', value: `${caseData.reportCount} phản ánh` },
                  {
                    label: 'Trạng thái',
                    value: DISPUTE_STATUS[caseData.status]?.label ?? caseData.status,
                  },
                ]}
              />

              {caseData.status === 'RESOLVED' || caseData.status === 'DISMISSED' ? (
                <FigmaInfoAlert tone="info">
                  Hồ sơ đã {DISPUTE_STATUS[caseData.status]?.label?.toLowerCase() ?? caseData.status}
                  {caseData.resolution
                    ? ` · Kết luận: ${DISPUTE_RESOLUTION[caseData.resolution] ?? caseData.resolution}${
                        caseData.refundPercentBp ? ` (${bpToPercent(caseData.refundPercentBp)})` : ''
                      }`
                    : ''}
                  {caseData.resolvedAt ? ` · ${formatDateTime(caseData.resolvedAt)}` : ''}
                </FigmaInfoAlert>
              ) : (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setResolution('PARTIAL_REFUND');
                      setPercent('50');
                      setScope('REPORTERS');
                      setNote('');
                      setScreen('a-dispute-resolve');
                    }}
                  >
                    Ra phán quyết tranh chấp
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-reports')}>
                    Quay lại danh sách
                  </button>
                </div>
              )}

              <div className="card" style={{ padding: 22, marginTop: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                  Phản ánh gốc ({(caseData.reports ?? []).length})
                </div>
                {(caseData.reports ?? []).length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Chưa có phản ánh nào.</div>
                )}
                {(caseData.reports ?? []).map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {DISPUTE_REPORT_CATEGORY[r.category] ?? r.category}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatDateTime(r.createdAt)}</div>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>{r.description}</div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding: 22, marginTop: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                  Hội thoại giải trình ({(caseData.messages ?? []).length})
                </div>
                {(caseData.messages ?? []).length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Chưa có trao đổi nào.</div>
                )}
                {(caseData.messages ?? []).map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      marginBottom: 8,
                      background: m.authorSide === 'ADMIN' ? 'var(--surface-2, #F8FAFC)' : '#FFFFFF',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>
                        {m.authorSide === 'ADMIN' ? 'Admin nền tảng' : 'Tổ chức'}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatDateTime(m.createdAt)}</div>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{m.body}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 3. a-dispute-resolve — the resolution form */}
      {activeScreen === 'a-dispute-resolve' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Phán quyết tranh chấp
            </div>
            <QueryNotice loading={!caseData} onRetry={() => setScreen('a-reports')} />
            {caseData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Hồ sơ</label>
                  <input
                    className="form-input"
                    readOnly
                    value={`${caseData.id.slice(0, 8)} · ${caseData.session?.event?.title ?? '—'}${caseData.session?.title ? ` · ${caseData.session.title}` : ''}`}
                  />
                </div>
                <div>
                  <label className="form-label">Kết luận xử lý</label>
                  <select
                    className="form-input"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value as 'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_ACTION')}
                  >
                    {Object.entries(DISPUTE_RESOLUTION).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                {resolution === 'PARTIAL_REFUND' && (
                  <div>
                    <label className="form-label">Tỷ lệ hoàn (%)</label>
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={100}
                      value={percent}
                      onChange={(e) => setPercent(e.target.value)}
                    />
                    {!percentValid && (
                      <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                        Nhập tỷ lệ từ 1 đến 100.
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="form-label">Phạm vi hoàn tiền</label>
                  <select
                    className="form-input"
                    value={scope}
                    onChange={(e) => setScope(e.target.value as 'REPORTERS' | 'ALL_TICKETS')}
                  >
                    <option value="REPORTERS">Chỉ vé của người phản ánh</option>
                    <option value="ALL_TICKETS">Toàn bộ vé của suất diễn</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Biên bản giải quyết gửi 2 bên</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Tổ chức đã hỗ trợ đổi suất tại cổng; hoàn một phần do nhầm lẫn thông tin giờ mở cổng."
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={resolveDispute.isPending || !percentValid}
                    onClick={runResolve}
                  >
                    Xác nhận phán quyết
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-dispute')}>
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
          <FigmaRecordInfoCard icon="shield" />
        </div>
      )}

      {/* 4. a-support — the support ticket queue */}
      {activeScreen === 'a-support' && (
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
              Phiếu hỗ trợ vận hành từ Tổ chức & Khách hàng
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {(supportRequests.data ?? []).length} bản ghi
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setScreen('a-reports')}
              >
                ← Hồ sơ tranh chấp
              </button>
            </div>
          </div>
          <QueryNotice
            loading={supportRequests.isPending}
            error={supportRequests.error}
            onRetry={() => supportRequests.refetch()}
            empty={supportRequests.isSuccess && !(supportRequests.data ?? []).length}
            emptyText="Chưa có phiếu hỗ trợ nào."
          />
          {!!(supportRequests.data ?? []).length && (
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ PHIẾU</th>
                    <th>CHỦ ĐỀ</th>
                    <th>NHÓM</th>
                    <th>SỐ TIN NHẮN</th>
                    <th>CẬP NHẬT</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {(supportRequests.data ?? []).map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{r.id.slice(0, 8)}</td>
                      <td>{r.subject}</td>
                      <td>{SUPPORT_CATEGORY[r.category] ?? r.category}</td>
                      <td>{r.messages.length}</td>
                      <td>{formatDateTime(r.updatedAt)}</td>
                      <td>
                        <span
                          className={`badge ${SUPPORT_STATUS[r.status]?.badge ?? 'badge-info'}`}
                        >
                          {SUPPORT_STATUS[r.status]?.label ?? r.status}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSupportId(r.id);
                            setSupportReply('');
                            setScreen('a-support-detail');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Phản hồi →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. a-support-detail — the ticket thread + reply */}
      {activeScreen === 'a-support-detail' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Chi tiết phiếu hỗ trợ
            </div>
            <QueryNotice
              loading={supportRequests.isPending}
              error={supportRequests.error}
              onRetry={() => supportRequests.refetch()}
              empty={!supportRequest}
              emptyText="Chọn một phiếu hỗ trợ từ danh sách."
            />
            {supportRequest && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label className="form-label">Yêu cầu từ khách hàng / tổ chức</label>
                    <input
                      className="form-input"
                      readOnly
                      value={`${SUPPORT_CATEGORY[supportRequest.category] ?? supportRequest.category} · ${supportRequest.subject}`}
                    />
                  </div>
                </div>

                <div style={{ marginTop: 16, marginBottom: 16 }}>
                  {supportRequest.messages.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        padding: '10px 14px',
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        marginBottom: 8,
                        background: m.authorSide === 'SUPPORT' ? 'var(--surface-2, #F8FAFC)' : '#FFFFFF',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>
                          {m.authorSide === 'SUPPORT' ? 'Bộ phận hỗ trợ' : 'Khách hàng / Tổ chức'}
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                          {formatDateTime(m.createdAt)}
                        </div>
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>{m.body}</div>
                    </div>
                  ))}
                  {supportRequest.messages.length === 0 && (
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Chưa có tin nhắn nào.</div>
                  )}
                </div>

                <div>
                  <label className="form-label">Nội dung phản hồi kỹ thuật</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={supportReply}
                    onChange={(e) => setSupportReply(e.target.value)}
                    placeholder="Đã làm mới chứng chỉ đồng bộ thiết bị tại Cổng G2. Vui lòng quét lại mã QR."
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={replySupport.isPending || !supportReply.trim() || supportRequest.status === 'CLOSED'}
                    onClick={() =>
                      replySupport.mutate(
                        { id: supportRequest.id, body: supportReply.trim() },
                        {
                          onSuccess: () => {
                            showToast('Đã gửi phản hồi hỗ trợ tới khách hàng.', 'success');
                            setSupportReply('');
                          },
                          onError: (error) => showToast(errorMessage(error), 'danger'),
                        },
                      )
                    }
                  >
                    Gửi phản hồi
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-support')}>
                    Quay lại
                  </button>
                </div>
              </>
            )}
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* Fallback for a stale screen id */}
      {!ADMIN_REPORT_SCREENS.some((s) => s.id === activeScreen) && (
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)' }}>
            <Scale size={18} /> Màn hình không tồn tại.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            onClick={() => setScreen('a-reports')}
          >
            Về danh sách tranh chấp
          </button>
        </div>
      )}
    </div>
  );
}
