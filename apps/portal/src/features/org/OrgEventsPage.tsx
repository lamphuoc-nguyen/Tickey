import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle2, Search } from 'lucide-react';
import { useToast } from '../../components/common/ToastProvider';
import { QueryNotice } from '../../components/common/QueryNotice';
import {
  FigmaInfoAlert,
  FigmaPageHeader,
  FigmaEventPreviewCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';
import { errorMessage, formatDateTime, formatVnd, useOrgId } from '../../lib/api';
import {
  EVENT_STATUS,
  SESSION_STATUS,
  TICKET_KIND,
  inventoryOf,
  useCancelEvent,
  useCancelSession,
  useOrgEventDetails,
  useSubmitEvent,
  useTicketTypes,
} from './data/event-data';
import { EventCreationWizard } from './events/EventCreationWizard';
import { EventForm } from './events/EventForm';
import { SeatManager } from './events/SeatManager';
import { SessionForm } from './events/SessionForm';
import { TicketTypeForm } from './events/TicketTypeForm';

const EVENT_SCREENS: FigmaScreenOption[] = [
  { id: 'o-events', label: 'Danh sách sự kiện' },
  { id: 'o-event-wizard', label: 'Tạo sự kiện mới (Wizard)' },
  { id: 'o-event-edit', label: 'Thông tin sự kiện' },
  { id: 'o-event-detail', label: 'Chi tiết sự kiện' },
  { id: 'o-session-edit', label: 'Cấu hình suất diễn' },
  { id: 'o-session-detail', label: 'Suất diễn · hạng vé' },
  { id: 'o-ticket-edit', label: 'Chỉnh sửa hạng vé' },
  { id: 'o-seat-pricing', label: 'Gán hạng vé theo ghế' },
  { id: 'o-seat-status', label: 'Trạng thái ghế theo suất diễn' },
  { id: 'o-review-submit', label: 'Gửi xét duyệt sự kiện' },
  { id: 'o-cancel', label: 'Yêu cầu hủy' },
];

const linkButton = {
  background: 'none',
  border: 'none',
  color: 'var(--primary)',
  fontWeight: 700,
  cursor: 'pointer',
} as const;

export function OrgEventsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const orgId = useOrgId();

  // The screen and the selected event / session / ticket type live in the URL so reloads and links work.
  const activeScreen = searchParams.get('screen') || 'o-events';
  const eventId = searchParams.get('event');
  const sessionId = searchParams.get('session');
  const ticketTypeId = searchParams.get('ticket');
  const go = (
    screen: string,
    ids: { event?: string | null; session?: string | null; ticket?: string | null } = {},
  ) => {
    const next: Record<string, string> = { screen };
    const e = ids.event === undefined ? eventId : ids.event;
    const s = ids.session === undefined ? sessionId : ids.session;
    const t = ids.ticket === undefined ? ticketTypeId : ids.ticket;
    if (e) next.event = e;
    if (s) next.session = s;
    if (t) next.ticket = t;
    setSearchParams(next);
  };

  const events = useOrgEventDetails(orgId);
  const event = events.data?.find((e) => e.id === eventId);
  const session = event?.sessions.find((s) => s.id === sessionId);
  const ticketTypes = useTicketTypes(session?.id);
  const ticketType = ticketTypes.data?.find((t) => t.id === ticketTypeId);
  const submit = useSubmitEvent(orgId);
  const cancelEvent = useCancelEvent(orgId);
  const cancelSession = useCancelSession(orgId);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cancelReason, setCancelReason] = useState('');

  const shownEvents = (events.data ?? []).filter(
    (e) =>
      (statusFilter === 'ALL' || e.status === statusFilter) &&
      e.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  // Same states save_event / submit_event_for_review accept (a PUBLISHED event only edits summary, description, cover).
  const canSubmit = event && ['DRAFT', 'CHANGES_REQUESTED'].includes(event.status);
  const canEditEvent = event && ['DRAFT', 'CHANGES_REQUESTED', 'PUBLISHED'].includes(event.status);

  const screenMeta = EVENT_SCREENS.find((s) => s.id === activeScreen) || EVENT_SCREENS[0];
  const needEvent =
    activeScreen !== 'o-events' &&
    activeScreen !== 'o-event-wizard' &&
    !(activeScreen === 'o-event-edit' && !eventId);
  const needSession =
    ['o-session-detail', 'o-ticket-edit', 'o-seat-pricing', 'o-seat-status'].includes(activeScreen) ||
    (activeScreen === 'o-cancel' && !!sessionId);

  const submitForReview = () =>
    event &&
    submit.mutate(event.id, {
      onSuccess: () =>
        showToast(
          'Đã gửi sự kiện. Sự kiện tổ chức mới hoặc lớn cần Admin duyệt trước khi công bố.',
          'success',
        ),
      onError: (error) => showToast(errorMessage(error), 'danger'),
    });

  const requestCancellation = () => {
    if (cancelReason.trim().length < 10) {
      showToast('Nêu lý do hủy (ít nhất 10 ký tự): khách hàng sẽ nhận thông báo này.', 'warning');
      return;
    }
    const onSuccess = () => {
      setCancelReason('');
      showToast('Đã gửi yêu cầu hủy: dừng bán ngay, chờ Admin duyệt rồi hoàn 100% cho khách.', 'success');
      go('o-event-detail', { session: null });
    };
    const onError = (error: unknown) => showToast(errorMessage(error), 'danger');
    if (session)
      cancelSession.mutate({ sessionId: session.id, reason: cancelReason.trim() }, { onSuccess, onError });
    else if (event)
      cancelEvent.mutate({ eventId: event.id, reason: cancelReason.trim() }, { onSuccess, onError });
  };

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={EVENT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={(screen) => go(screen)}
      />

      {needEvent && (
        <QueryNotice
          loading={events.isLoading}
          error={events.error}
          empty={events.isSuccess && (!event || (needSession && !session))}
          emptyText="Không tìm thấy sự kiện / suất diễn. Chọn lại từ danh sách sự kiện."
          onRetry={() => void events.refetch()}
        />
      )}

      {/* o-events */}
      {activeScreen === 'o-events' && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ position: 'relative', width: 300 }}>
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
                  placeholder="Tìm sự kiện..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="form-select"
                style={{ width: 180 }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                {Object.entries(EVENT_STATUS).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => go('o-event-wizard', { event: null, session: null, ticket: null })}
            >
              + Tạo sự kiện
            </button>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <QueryNotice
              loading={events.isLoading}
              error={events.error}
              empty={events.isSuccess && !shownEvents.length}
              emptyText="Chưa có sự kiện."
              onRetry={() => void events.refetch()}
            />
            {!!shownEvents.length && (
              <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>SỰ KIỆN</th>
                      <th>SUẤT DIỄN</th>
                      <th>SUẤT GẦN NHẤT</th>
                      <th>TRẠNG THÁI</th>
                      <th>THAO TÁC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownEvents.map((e) => {
                      const next = [...e.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
                      return (
                        <tr key={e.id}>
                          <td style={{ fontWeight: 700 }}>{e.title}</td>
                          <td>{e.sessions.length}</td>
                          <td>{next ? formatDateTime(next.startsAt, next.venue?.timezone) : '—'}</td>
                          <td>
                            <span className={`badge ${EVENT_STATUS[e.status]?.badge ?? 'badge-info'}`}>
                              {EVENT_STATUS[e.status]?.label ?? e.status}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              style={linkButton}
                              onClick={() =>
                                go('o-event-detail', { event: e.id, session: null, ticket: null })
                              }
                            >
                              Chi tiết →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* o-event-wizard */}
      {activeScreen === 'o-event-wizard' && (
        <EventCreationWizard
          onComplete={(id) => go('o-event-detail', { event: id, session: null, ticket: null })}
          onCancel={() => go('o-events')}
        />
      )}

      {/* o-event-edit */}
      {activeScreen === 'o-event-edit' && !eventId && (
        <EventCreationWizard
          onComplete={(id) => go('o-event-detail', { event: id, session: null, ticket: null })}
          onCancel={() => go('o-events')}
        />
      )}
      {activeScreen === 'o-event-edit' && !!eventId && !!event && (
        <EventForm
          key={event.id}
          event={event}
          onSaved={(id) => go('o-event-detail', { event: id })}
          onCancel={() => go('o-event-detail')}
        />
      )}

      {/* o-event-detail */}
      {activeScreen === 'o-event-detail' && event && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="card" style={{ padding: 22 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700 }}>
                  {event.title}
                </div>
                <span className={`badge ${EVENT_STATUS[event.status]?.badge}`}>
                  {EVENT_STATUS[event.status]?.label ?? event.status}
                </span>
              </div>
              {event.status === 'PENDING_REVIEW' && (
                <FigmaInfoAlert tone="info">
                  Đang chờ Admin duyệt. Chưa bán vé cho đến khi được công bố.
                </FigmaInfoAlert>
              )}
              {event.status === 'CHANGES_REQUESTED' && (
                <FigmaInfoAlert tone="warning">
                  Admin yêu cầu chỉnh sửa. Cập nhật rồi gửi duyệt lại.
                </FigmaInfoAlert>
              )}
              <div style={{ fontSize: 13.5, color: 'var(--muted)', margin: '10px 0' }}>
                {event.summary ?? 'Chưa có tóm tắt.'}
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {canEditEvent && (
                  <button type="button" className="btn btn-secondary" onClick={() => go('o-event-edit')}>
                    Sửa thông tin
                  </button>
                )}
                {canSubmit && (
                  <button type="button" className="btn btn-primary" onClick={() => go('o-review-submit')}>
                    Gửi xét duyệt
                  </button>
                )}
                {event.status === 'PUBLISHED' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => go('o-cancel', { session: null })}
                  >
                    Yêu cầu hủy sự kiện
                  </button>
                )}
              </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                  Suất diễn
                </div>
                {canEditEvent && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => go('o-session-edit', { session: null })}
                  >
                    + Thêm suất diễn
                  </button>
                )}
              </div>
              <QueryNotice
                empty={!event.sessions.length}
                emptyText="Chưa có suất diễn. Thêm suất diễn, hạng vé rồi gửi duyệt."
              />
              {!!event.sessions.length && (
                <table className="table">
                  <thead>
                    <tr>
                      <th>SUẤT</th>
                      <th>ĐỊA ĐIỂM</th>
                      <th>GIỜ DIỄN</th>
                      <th>MỞ BÁN</th>
                      <th>TRẠNG THÁI</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {[...event.sessions]
                      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
                      .map((s) => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 700 }}>{s.title ?? 'Suất diễn'}</td>
                          <td>{s.venue?.name}</td>
                          <td>{formatDateTime(s.startsAt, s.venue?.timezone)}</td>
                          <td>{formatDateTime(s.salesStartAt, s.venue?.timezone)}</td>
                          <td>
                            {SESSION_STATUS[s.status] ?? s.status}
                            {s.salesPaused && (
                              <span className="badge badge-warning" style={{ marginLeft: 6 }}>
                                Tạm dừng bán
                              </span>
                            )}
                          </td>
                          <td>
                            <button
                              type="button"
                              style={linkButton}
                              onClick={() => go('o-session-detail', { session: s.id, ticket: null })}
                            >
                              Quản lý →
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <FigmaEventPreviewCard
            title={event.title}
            subtitle={event.summary ?? ''}
            badge={EVENT_STATUS[event.status]?.label}
            image={event.coverImageUrl}
          />
        </div>
      )}

      {/* o-session-edit */}
      {activeScreen === 'o-session-edit' && event && (
        <SessionForm
          key={session?.id ?? 'new'}
          event={event}
          session={session}
          onSaved={(id) => go('o-session-detail', { session: id })}
          onCancel={() => go(session ? 'o-session-detail' : 'o-event-detail')}
        />
      )}

      {/* o-session-detail */}
      {activeScreen === 'o-session-detail' && event && session && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div
            className="card"
            style={{
              padding: 22,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
                {event.title} · {session.title ?? 'Suất diễn'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                {session.venue?.name} · {formatDateTime(session.startsAt, session.venue?.timezone)} ·{' '}
                {SESSION_STATUS[session.status] ?? session.status}
                {session.salesPaused ? ' · Tạm dừng bán' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => go('o-event-detail', { session: null })}
              >
                ← Sự kiện
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => go('o-session-edit')}>
                Cấu hình suất
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => go('o-seat-pricing')}>
                Gán hạng vé theo ghế
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => go('o-seat-status')}>
                Giữ / chặn ghế
              </button>
              {!['CANCELLED', 'ENDED'].includes(session.status) && (
                <button type="button" className="btn btn-secondary" onClick={() => go('o-cancel')}>
                  Yêu cầu hủy suất
                </button>
              )}
            </div>
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                Hạng vé & quota
              </div>
              {['SCHEDULED', 'ON_SALE'].includes(session.status) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => go('o-ticket-edit', { ticket: null })}
                >
                  + Thêm hạng vé
                </button>
              )}
            </div>
            <QueryNotice
              loading={ticketTypes.isLoading}
              error={ticketTypes.error}
              empty={ticketTypes.isSuccess && !ticketTypes.data.length}
              emptyText="Chưa có hạng vé."
            />
            {!!ticketTypes.data?.length && (
              <table className="table">
                <thead>
                  <tr>
                    <th>HẠNG VÉ</th>
                    <th>LOẠI</th>
                    <th>GIÁ</th>
                    <th>ĐÃ BÁN / ĐANG GIỮ / QUOTA</th>
                    <th>HIỂN THỊ</th>
                    <th>TRẠNG THÁI</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {ticketTypes.data.map((t) => {
                    const inv = inventoryOf(t);
                    return (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 700 }}>{t.name}</td>
                        <td>{TICKET_KIND[t.kind]}</td>
                        <td>{formatVnd(t.priceAmount)}</td>
                        <td>
                          {inv.sold} / {inv.locked} / {inv.quota}
                        </td>
                        <td>{t.visibility === 'PUBLIC' ? 'Công khai' : 'Ẩn'}</td>
                        <td>{t.status === 'ACTIVE' ? 'Đang bán' : 'Ngừng bán'}</td>
                        <td>
                          <button
                            type="button"
                            style={linkButton}
                            onClick={() => go('o-ticket-edit', { ticket: t.id })}
                          >
                            Sửa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* o-ticket-edit */}
      {activeScreen === 'o-ticket-edit' && session && (!ticketTypeId || ticketType) && (
        <TicketTypeForm
          key={ticketType?.id ?? 'new'}
          session={session}
          ticketType={ticketType}
          onSaved={() => go('o-session-detail', { ticket: null })}
          onCancel={() => go('o-session-detail', { ticket: null })}
        />
      )}

      {/* o-seat-pricing / o-seat-status */}
      {(activeScreen === 'o-seat-pricing' || activeScreen === 'o-seat-status') && session && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <button type="button" className="btn btn-secondary" onClick={() => go('o-session-detail')}>
              ← {event?.title} · {session.title ?? 'Suất diễn'}
            </button>
          </div>
          <SeatManager session={session} mode={activeScreen === 'o-seat-pricing' ? 'pricing' : 'status'} />
        </div>
      )}

      {/* o-review-submit */}
      {activeScreen === 'o-review-submit' && event && (
        <div
          className="card"
          style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
            Gửi xét duyệt · {event.title}
          </div>
          {event.status === 'PENDING_REVIEW' || event.status === 'PUBLISHED' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CheckCircle2 color="#18794E" />
              {event.status === 'PUBLISHED' ? 'Sự kiện đã được công bố.' : 'Đã gửi, đang chờ Admin duyệt.'}
            </div>
          ) : (
            <>
              <FigmaInfoAlert tone="info">
                Cần ít nhất một suất diễn có hạng vé đang bán. Tổ chức mới hoặc sự kiện lớn được Admin duyệt;
                các sự kiện khác công bố ngay. Suất diễn tự mở bán đến giờ.
              </FigmaInfoAlert>
              <div style={{ fontSize: 13.5 }}>
                {event.sessions.length} suất diễn ·{' '}
                {event.sessions
                  .map((s) => `${s.title ?? 'Suất'} (${formatDateTime(s.startsAt, s.venue?.timezone)})`)
                  .join(', ') || 'chưa có'}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={submit.isPending}
                  onClick={submitForReview}
                >
                  {submit.isPending ? 'Đang gửi…' : 'Gửi xét duyệt'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => go('o-event-detail')}>
                  Quay lại
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* o-cancel */}
      {activeScreen === 'o-cancel' && event && (!sessionId || session) && (
        <div
          className="card"
          style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 720 }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700 }}>
            {session
              ? `Yêu cầu hủy suất · ${session.title ?? 'Suất diễn'}`
              : `Yêu cầu hủy sự kiện · ${event.title}`}
          </div>
          <FigmaInfoAlert tone="warning">
            Dừng bán ngay khi gửi. Admin duyệt rồi hệ thống hoàn 100% cho khách, sau đó mới thông báo hủy.
            Không thể rút lại.
          </FigmaInfoAlert>
          <textarea
            className="form-input"
            rows={4}
            placeholder="Lý do hủy (khách hàng sẽ nhận được nội dung này)"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={cancelEvent.isPending || cancelSession.isPending}
              onClick={requestCancellation}
            >
              Gửi yêu cầu hủy
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => go(session ? 'o-session-detail' : 'o-event-detail')}
            >
              Quay lại
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
