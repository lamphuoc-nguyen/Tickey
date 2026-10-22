import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Calendar, Search } from 'lucide-react';
import { errorMessage, formatDateTime } from '../../lib/api';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaEventPreviewCard,
  FigmaInfoAlert,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import {
  ADMIN_EVENT_STATUS,
  useAdminEvents,
  useReviewEvent,
  type AdminEvent,
} from './data/admin-data';
import { SESSION_STATUS } from '../org/data/event-data';

const ADMIN_EVENT_SCREENS: FigmaScreenOption[] = [
  { id: 'a-events', label: 'Kiểm duyệt sự kiện' },
  { id: 'a-event-review', label: 'Chi tiết & duyệt sự kiện' },
  { id: 'a-event-note', label: 'Từ chối / yêu cầu chỉnh sửa' },
];

/** Statuses an Admin can filter the event queue by. Approval publishes directly, so there is no APPROVED. */
const EVENT_FILTERS = [
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'CHANGES_REQUESTED', label: 'Đã yêu cầu chỉnh sửa' },
  { value: 'PUBLISHED', label: 'Đã phát hành' },
  { value: 'REJECTED', label: 'Bị từ chối' },
];

function StatusBadge({ status }: { status: string }) {
  const meta = ADMIN_EVENT_STATUS[status] ?? { label: status, badge: 'badge-info' };
  return <span className={`badge ${meta.badge}`}>{meta.label}</span>;
}

export function AdminEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-events';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [noteDecision, setNoteDecision] = useState<'CHANGES_REQUESTED' | 'REJECTED'>('CHANGES_REQUESTED');

  const events = useAdminEvents(statusFilter);
  const reviewEvent = useReviewEvent();

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const all = events.data ?? [];
    if (!needle) return all;
    return all.filter((e) =>
      `${e.org?.name ?? ''} ${e.title}`.toLowerCase().includes(needle),
    );
  }, [events.data, search]);

  const selectedEvent: AdminEvent | undefined =
    (events.data ?? []).find((e) => e.id === selectedEventId) ?? undefined;

  const screenMeta = ADMIN_EVENT_SCREENS.find((s) => s.id === activeScreen) || ADMIN_EVENT_SCREENS[0];

  const runReview = (decision: string, noteText?: string) => {
    if (!selectedEvent) return;
    reviewEvent.mutate(
      { id: selectedEvent.id, decision, note: noteText },
      {
        onSuccess: () => {
          const label = ADMIN_EVENT_STATUS[decision]?.label ?? decision;
          showToast(`Đã cập nhật sự kiện "${selectedEvent.title}": ${label}.`, 'success');
          setNote('');
          setScreen('a-events');
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
        screens={ADMIN_EVENT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-events — the review queue */}
      {activeScreen === 'a-events' && (
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
                  placeholder="Tìm theo tên sự kiện, tổ chức..."
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
                {EVENT_FILTERS.map((f) => (
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
                Danh sách sự kiện cần kiểm duyệt
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{filtered.length} bản ghi</div>
            </div>
            <QueryNotice
              loading={events.isPending}
              error={events.error}
              onRetry={() => events.refetch()}
              empty={events.isSuccess && !(events.data ?? []).length}
              emptyText="Không có sự kiện nào ở trạng thái này."
            />
            {!!filtered.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>SỰ KIỆN</th>
                      <th>TỔ CHỨC</th>
                      <th>SUẤT DIỄN</th>
                      <th>CẬP NHẬT</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e) => (
                      <tr key={e.id}>
                        <td style={{ fontWeight: 700 }}>{e.title}</td>
                        <td>{e.org?.name ?? '—'}</td>
                        <td>{e.sessions.length}</td>
                        <td>{formatDateTime(e.updatedAt)}</td>
                        <td>
                          <StatusBadge status={e.status} />
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEventId(e.id);
                              setScreen('a-event-review');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Kiểm duyệt →
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
            Việc hủy sự kiện và hoàn tiền hàng loạt đi theo Phiếu phê duyệt hai người ở mục “Phiếu phê duyệt”.
          </FigmaInfoAlert>
        </div>
      )}

      {/* 2. a-event-review — detail + decisions */}
      {activeScreen === 'a-event-review' && (
        <div>
          <QueryNotice
            loading={events.isPending}
            error={events.error}
            onRetry={() => events.refetch()}
            empty={!selectedEvent}
            emptyText="Chọn một sự kiện từ danh sách để kiểm duyệt."
          />
          {selectedEvent && (
            <>
              <FigmaNavyContextBanner
                title={selectedEvent.org?.name ?? 'Tổ chức'}
                subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
                badge={ADMIN_EVENT_STATUS[selectedEvent.status]?.label ?? selectedEvent.status}
                image={selectedEvent.coverImageUrl}
              />
              <FigmaContextGrid
                items={[
                  { label: 'Sự kiện & Tổ chức', value: `${selectedEvent.title} · ${selectedEvent.org?.name ?? '—'}` },
                  { label: 'Tóm tắt', value: selectedEvent.summary || '—' },
                  { label: 'Số suất diễn', value: `${selectedEvent.sessions.length} suất` },
                  { label: 'Trạng thái', value: ADMIN_EVENT_STATUS[selectedEvent.status]?.label ?? selectedEvent.status },
                ]}
              />

              <div className="card" style={{ padding: 22, marginBottom: 14 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, marginBottom: 12 }}>
                  Suất diễn
                </div>
                {selectedEvent.sessions.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sự kiện chưa có suất diễn nào.</div>
                )}
                {selectedEvent.sessions.map((s) => (
                  <div
                    key={s.id}
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
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{s.title || selectedEvent.title}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        {formatDateTime(s.startsAt)} — {formatDateTime(s.endsAt)}
                      </div>
                    </div>
                    <span className="badge badge-info" style={{ alignSelf: 'center' }}>
                      {SESSION_STATUS[s.status] ?? s.status}
                    </span>
                  </div>
                ))}
              </div>

              {selectedEvent.status === 'PENDING_REVIEW' ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={reviewEvent.isPending}
                    onClick={() => runReview('APPROVED')}
                  >
                    Phê duyệt mở bán
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setNoteDecision('CHANGES_REQUESTED');
                      setNote('');
                      setScreen('a-event-note');
                    }}
                  >
                    Yêu cầu chỉnh sửa
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setNoteDecision('REJECTED');
                      setNote('');
                      setScreen('a-event-note');
                    }}
                  >
                    Từ chối hồ sơ
                  </button>
                </div>
              ) : (
                <FigmaInfoAlert tone="info">
                  Sự kiện đang ở trạng thái{' '}
                  {ADMIN_EVENT_STATUS[selectedEvent.status]?.label ?? selectedEvent.status}. Chỉ sự kiện Chờ duyệt mới
                  có thể ra quyết định.
                </FigmaInfoAlert>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. a-event-note — required note for CHANGES_REQUESTED / REJECTED */}
      {activeScreen === 'a-event-note' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              {noteDecision === 'REJECTED' ? 'Từ chối mở bán sự kiện' : 'Yêu cầu chỉnh sửa hồ sơ'}
            </div>
            <QueryNotice loading={!selectedEvent} onRetry={() => setScreen('a-events')} />
            {selectedEvent && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Sự kiện</label>
                  <input
                    className="form-input"
                    readOnly
                    value={`${selectedEvent.title} · ${selectedEvent.org?.name ?? '—'}`}
                  />
                </div>
                <div>
                  <label className="form-label">Lý do / nội dung cần chỉnh sửa (bắt buộc)</label>
                  <textarea
                    className="form-input"
                    rows={4}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      noteDecision === 'REJECTED'
                        ? 'Nội dung sự kiện vi phạm chính sách nền tảng.'
                        : 'Bổ sung giấy phép biểu diễn và mô tả điều khoản hoàn vé.'
                    }
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={reviewEvent.isPending || !note.trim()}
                    onClick={() => runReview(noteDecision, note.trim())}
                  >
                    {noteDecision === 'REJECTED' ? 'Xác nhận từ chối' : 'Gửi yêu cầu chỉnh sửa'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScreen('a-event-review')}>
                    Quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
          {selectedEvent ? (
            <FigmaEventPreviewCard
              title={selectedEvent.title}
              subtitle={selectedEvent.org?.name ?? 'Tổ chức'}
              badge={ADMIN_EVENT_STATUS[selectedEvent.status]?.label ?? selectedEvent.status}
              image={selectedEvent.coverImageUrl}
            />
          ) : (
            <FigmaRecordInfoCard icon="shield" />
          )}
        </div>
      )}

      {/* Fallback for a stale screen id */}
      {!ADMIN_EVENT_SCREENS.some((s) => s.id === activeScreen) && (
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)' }}>
            <Calendar size={18} /> Màn hình không tồn tại.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            onClick={() => setScreen('a-events')}
          >
            Về danh sách kiểm duyệt
          </button>
        </div>
      )}
    </div>
  );
}
