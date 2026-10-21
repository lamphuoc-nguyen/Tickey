import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search, MessageSquareText, FileText } from 'lucide-react';
import { useOrgId, formatVnd, formatDateTime, errorMessage } from '../../lib/api';
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
  REFUND_REASON,
  REFUND_STATUS,
  useOrgDispute,
  useOrgDisputes,
  useOrgRefunds,
  useRespondToDispute,
} from './data/report-data';

const REPORT_SCREENS: FigmaScreenOption[] = [
  { id: 'o-disputes', label: 'Phản ánh & tranh chấp' },
  { id: 'o-dispute-detail', label: 'Chi tiết & giải trình tranh chấp' },
  { id: 'o-refunds', label: 'Yêu cầu hoàn tiền' },
];

function StatusBadge({ map, status }: { map: Record<string, { label: string; badge: string }>; status: string }) {
  const meta = map[status] ?? { label: status, badge: 'badge-info' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ color: 'var(--muted)', fontSize: 13 }}>
        {text}
      </td>
    </tr>
  );
}

export function OrgReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const orgId = useOrgId();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-disputes';
  const setScreen = (screen: string, caseId?: string) =>
    setSearchParams(caseId ? { screen, id: caseId } : { screen });

  const [search, setSearch] = useState('');
  const caseId = searchParams.get('id');
  const [reply, setReply] = useState('');

  const disputes = useOrgDisputes(orgId);
  const refunds = useOrgRefunds(orgId);
  const detailId = activeScreen === 'o-dispute-detail' ? caseId : null;
  const dispute = useOrgDispute(detailId);
  const respond = useRespondToDispute(orgId, detailId);

  const screenMeta = REPORT_SCREENS.find((s) => s.id === activeScreen) || REPORT_SCREENS[0];

  const term = search.trim().toLowerCase();
  const visibleDisputes = (disputes.data ?? []).filter((d) => {
    if (!term) return true;
    const haystack = [d.id, d.sessionId, d.session?.title ?? '', d.session?.event?.title ?? ''].join(' ').toLowerCase();
    return haystack.includes(term);
  });

  const openCase = (id: string) => {
    setReply('');
    setScreen('o-dispute-detail', id);
  };

  const submitReply = () => {
    if (!reply.trim()) {
      showToast('Vui lòng nhập nội dung giải trình.', 'danger');
      return;
    }
    respond.mutate(
      { body: reply.trim() },
      {
        onSuccess: () => {
          showToast('Đã gửi giải trình tới Admin.', 'success');
          setReply('');
        },
        onError: (error) => showToast(errorMessage(error), 'danger'),
      },
    );
  };

  const caseRow = dispute.data;

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={REPORT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={(id) => (id === 'o-dispute-detail' ? openCase(caseId ?? '') : setScreen(id))}
      />

      {/* 1. o-disputes */}
      {activeScreen === 'o-disputes' && (
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
                  placeholder="Tìm theo mã hồ sơ, suất diễn..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-refunds')}>
                Yêu cầu hoàn tiền
              </button>
            </div>
          </div>

          <FigmaInfoAlert tone="info">
            Tranh chấp phát sinh khi một suất diễn nhận đủ ngưỡng phản ánh. Org có thể gửi giải trình cho tới hạn phản hồi;
            kết luận cuối cùng do Admin nền tảng thực hiện.
          </FigmaInfoAlert>

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
                Tất cả danh sách phản ánh
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{disputes.data?.length ?? 0} bản ghi</div>
            </div>
            <QueryNotice
              loading={disputes.isLoading}
              error={disputes.error}
              empty={!disputes.isLoading && !disputes.data?.length}
              emptyText="Chưa có phản ánh hay tranh chấp nào."
              onRetry={() => void disputes.refetch()}
            />
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ HS</th>
                    <th>SUẤT DIỄN</th>
                    <th>SỐ PHẢN ÁNH</th>
                    <th>HẠN PHẢN HỒI</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDisputes.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.id.slice(0, 8).toUpperCase()}</td>
                      <td>
                        {d.session?.title || 'Suất diễn'}
                        {d.session?.event?.title ? (
                          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{d.session.event.title}</div>
                        ) : null}
                      </td>
                      <td>{d.reportCount}</td>
                      <td>{formatDateTime(d.orgResponseDueAt)}</td>
                      <td>
                        <StatusBadge map={DISPUTE_STATUS} status={d.status} />
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => openCase(d.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {d.status === 'OPEN' || d.status === 'AWAITING_ORG' ? 'Giải trình →' : 'Xem →'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!disputes.isLoading && !disputes.error && !visibleDisputes.length && (
                    <EmptyRow colSpan={6} text="Không có phản ánh nào khớp tìm kiếm." />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. o-dispute-detail */}
      {activeScreen === 'o-dispute-detail' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-disputes')}>
              ← Danh sách phản ánh
            </button>
          </div>

          <QueryNotice
            loading={dispute.isLoading}
            error={dispute.error}
            onRetry={() => void dispute.refetch()}
          />

          {!detailId && <FigmaInfoAlert tone="warning">Chọn một hồ sơ từ danh sách để xem chi tiết.</FigmaInfoAlert>}

          {caseRow && (
            <>
              <FigmaNavyContextBanner
                title={caseRow.session?.title || 'Suất diễn'}
                subtitle={caseRow.session?.event?.title || 'Hồ sơ tranh chấp của tổ chức'}
                badge={DISPUTE_STATUS[caseRow.status]?.label ?? caseRow.status}
              />

              <FigmaContextGrid
                columns={2}
                items={[
                  { label: 'Mã hồ sơ', value: caseRow.id.slice(0, 8).toUpperCase() },
                  { label: 'Số phản ánh', value: String(caseRow.reportCount) },
                  { label: 'Hạn phản hồi', value: formatDateTime(caseRow.orgResponseDueAt) },
                  { label: 'Thời điểm mở', value: formatDateTime(caseRow.createdAt) },
                  ...(caseRow.resolution
                    ? [
                        { label: 'Kết luận', value: DISPUTE_RESOLUTION[caseRow.resolution] ?? caseRow.resolution },
                        {
                          label: 'Tỷ lệ hoàn',
                          value: caseRow.refundPercentBp != null ? `${caseRow.refundPercentBp / 100}%` : '—',
                        },
                      ]
                    : []),
                ]}
              />

              {caseRow.resolutionNote && (
                <FigmaInfoAlert tone="info">Kết luận của Admin: {caseRow.resolutionNote}</FigmaInfoAlert>
              )}

              {!!caseRow.reports?.length && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                  <div
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 700,
                    }}
                  >
                    <FileText size={16} /> Phản ánh gốc từ khách hàng
                  </div>
                  <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>LOẠI</th>
                          <th>NỘI DUNG</th>
                          <th>THỜI ĐIỂM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {caseRow.reports.map((r) => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 700 }}>
                              {DISPUTE_REPORT_CATEGORY[r.category] ?? r.category}
                            </td>
                            <td>{r.description}</td>
                            <td>{formatDateTime(r.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontWeight: 700,
                  }}
                >
                  <MessageSquareText size={16} /> Trao đổi với Admin
                </div>
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {caseRow.messages?.length ? (
                    caseRow.messages.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          alignSelf: m.authorSide === 'ORG' ? 'flex-end' : 'flex-start',
                          maxWidth: '78%',
                          background: m.authorSide === 'ORG' ? '#EDF3FF' : '#F7F5F1',
                          borderRadius: 12,
                          padding: '10px 14px',
                        }}
                      >
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 4 }}>
                          {m.authorSide === 'ORG' ? 'Tổ chức' : 'Admin'} · {formatDateTime(m.createdAt)}
                        </div>
                        <div style={{ fontSize: 13.5 }}>{m.body}</div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>Chưa có trao đổi nào.</div>
                  )}
                </div>
              </div>

              {caseRow.status === 'RESOLVED' || caseRow.status === 'DISMISSED' ? (
                <FigmaInfoAlert tone="info">
                  Hồ sơ đã khép lại nên không thể gửi thêm giải trình.
                </FigmaInfoAlert>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
                  <div className="card" style={{ padding: 22 }}>
                    <div
                      style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}
                    >
                      Nội dung giải trình từ Tổ chức
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <textarea
                        className="form-input"
                        rows={4}
                        placeholder="Mô tả tình huống, biện pháp đã xử lý và bằng chứng kèm theo..."
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                      />
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={respond.isPending}
                          onClick={submitReply}
                        >
                          {respond.isPending ? 'Đang gửi…' : 'Gửi giải trình'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-disputes')}>
                          Quay lại
                        </button>
                      </div>
                    </div>
                  </div>
                  <FigmaRecordInfoCard />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. o-refunds */}
      {activeScreen === 'o-refunds' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setScreen('o-disputes')}>
              ← Danh sách phản ánh
            </button>
          </div>

          <FigmaInfoAlert tone="info">
            Yêu cầu hoàn tiền được nền tảng xử lý và duyệt. Org chỉ theo dõi tiến độ và số tiền hoàn trả cho khách.
          </FigmaInfoAlert>

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
                Yêu cầu hoàn tiền từ khách hàng
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{refunds.data?.length ?? 0} bản ghi</div>
            </div>
            <QueryNotice
              loading={refunds.isLoading}
              error={refunds.error}
              empty={!refunds.isLoading && !refunds.data?.length}
              emptyText="Chưa có yêu cầu hoàn tiền nào."
              onRetry={() => void refunds.refetch()}
            />
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ HOÀN</th>
                    <th>ĐƠN VÉ</th>
                    <th>SỐ TIỀN</th>
                    <th>LÝ DO</th>
                    <th>NGÀY YÊU CẦU</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.data?.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{r.id.slice(0, 8).toUpperCase()}</td>
                      <td>{r.bookingId.slice(0, 8).toUpperCase()}</td>
                      <td style={{ fontWeight: 700 }}>{formatVnd(r.amount)}</td>
                      <td>{REFUND_REASON[r.reason] ?? r.reason}</td>
                      <td>{formatDateTime(r.createdAt)}</td>
                      <td>
                        <StatusBadge map={REFUND_STATUS} status={r.status} />
                      </td>
                    </tr>
                  ))}
                  {!refunds.isLoading && !refunds.error && !refunds.data?.length && (
                    <EmptyRow colSpan={6} text="Chưa có yêu cầu hoàn tiền nào." />
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
