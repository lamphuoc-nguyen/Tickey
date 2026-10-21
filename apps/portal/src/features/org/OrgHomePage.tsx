import { useMemo, useState } from 'react';
import {
  CalendarClock,
  Clock,
  CreditCard,
  Filter,
  Plus,
  Search,
  Ticket,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router';
import { formatDateTime, formatVnd, useOrgId } from '../../lib/api';
import { QueryNotice } from '../../components/common/QueryNotice';
import { ORG_STATUS } from './data/org-data';
import { useOrgHome, type UpcomingSession } from './data/home-data';

function StatCard({
  label,
  value,
  icon,
  note,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="card" style={{ padding: '20px 24px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>{label}</span>
        {icon}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '32px',
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: '8px',
        }}
      >
        {value}
      </div>
      {note && <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{note}</div>}
    </div>
  );
}

export function OrgHomePage() {
  const navigate = useNavigate();
  const orgId = useOrgId();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const home = useOrgHome(orgId);
  const org = home.org.data;
  const summary = home.finance.data;

  const ticketsSold = useMemo(
    () =>
      (home.events.data ?? [])
        .flatMap((event) => event.sessions)
        .filter((session) => session.status === 'ON_SALE' || session.status === 'SOLD_OUT')
        .length,
    [home.events.data],
  );

  const filteredTodos = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return home.todos.filter((item) => {
      const matchSearch =
        !needle ||
        item.title.toLowerCase().includes(needle) ||
        item.details.toLowerCase().includes(needle);
      const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [home.todos, searchTerm, statusFilter]);

  const statusOptions = useMemo(
    () => Array.from(new Set(home.todos.map((item) => item.status))),
    [home.todos],
  );

  const feature = home.upcoming[0] ?? null;
  const orgMeta = org ? (ORG_STATUS[org.status] ?? { label: org.status, badge: 'badge-info' }) : null;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header Title */}
      <div style={{ marginBottom: '28px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <span className="tag-overline">TICKEY / ORGANIZATION</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            {org ? org.name : 'Tổng quan tổ chức'}
          </h1>
        </div>
        {orgMeta && <span className={`badge ${orgMeta.badge}`}>{orgMeta.label}</span>}
      </div>

      <QueryNotice
        loading={home.isPending}
        error={home.org.error || home.finance.error}
        onRetry={() => home.refetch()}
      />

      {!home.isPending && !home.org.error && !home.finance.error && (
        <>
          {/* Stat Cards Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: '20px',
              marginBottom: '28px',
            }}
          >
            <StatCard
              label={`Suất đang mở bán · ${home.upcoming.length} sắp diễn`}
              value={String(ticketsSold)}
              icon={<Ticket size={18} color="var(--primary)" />}
              note="Số suất ở trạng thái đang bán / hết vé"
            />
            <StatCard
              label="Số dư quỹ"
              value={formatVnd(summary?.ledgerBalance)}
              icon={<CreditCard size={18} color="var(--primary)" />}
              note={summary ? `Sẵn sàng chi trả: ${formatVnd(summary.ready)}` : undefined}
            />
            <StatCard
              label="Suất sắp diễn"
              value={String(home.upcoming.length)}
              icon={<CalendarClock size={18} color="var(--primary)" />}
              note="Tính từ thời điểm hiện tại"
            />
            <StatCard
              label="Việc cần xử lý"
              value={String(home.todos.length)}
              icon={<Clock size={18} color="var(--primary)" />}
              note="Tranh chấp và hoàn tiền đang mở"
            />
          </div>

          {/* Middle Row: Upcoming sessions + Featured Event Card */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)',
              gap: '24px',
              marginBottom: '36px',
            }}
          >
            <div className="card" style={{ padding: '28px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '17px',
                    fontWeight: 700,
                    margin: '0 0 4px',
                  }}
                >
                  Suất diễn sắp tới
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                  {home.upcoming.length} suất · theo thời gian bắt đầu
                </p>
              </div>
              <QueryNotice
                loading={home.events.isPending}
                error={home.events.error}
                onRetry={() => home.events.refetch()}
                empty={!home.upcoming.length}
                emptyText="Chưa có suất diễn nào sắp diễn."
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {home.upcoming.slice(0, 6).map(({ session, event }: UpcomingSession) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => navigate(`/org/events?event=${event.id}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      padding: '12px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      background: 'transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                        {event.title}
                        {session.title ? ` · ${session.title}` : ''}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {formatDateTime(session.startsAt, session.venue?.timezone)} ·{' '}
                        {session.venue?.name ?? 'Chưa gán địa điểm'}
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        session.salesPaused ? 'badge-warning' : 'badge-success'
                      }`}
                    >
                      {session.salesPaused ? 'Tạm ngưng bán' : session.status}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Featured upcoming session */}
            {feature && (
              <div
                style={{
                  backgroundColor: 'var(--navy)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: 'var(--shadow-md)',
                }}
              >
                {feature.event.coverImageUrl && (
                  <div style={{ padding: '12px 12px 0', flexShrink: 0 }}>
                    <img
                      src={feature.event.coverImageUrl}
                      alt={feature.event.title}
                      style={{
                        width: '100%',
                        height: '156px',
                        objectFit: 'cover',
                        borderRadius: '10px',
                        display: 'block',
                      }}
                    />
                  </div>
                )}
                <div
                  style={{
                    padding: '20px 24px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    flex: 1,
                    color: '#FFFFFF',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '11px',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: 'rgba(255,255,255,0.6)',
                        marginBottom: 6,
                      }}
                    >
                      Suất gần nhất
                    </div>
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '20px',
                        fontWeight: 700,
                        color: '#FFFFFF',
                        marginBottom: '8px',
                      }}
                    >
                      {feature.event.title}
                    </h3>
                    <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
                      {formatDateTime(feature.session.startsAt, feature.session.venue?.timezone)}
                      {feature.session.venue ? ` · ${feature.session.venue.name}` : ''}
                    </p>
                  </div>

                  <div style={{ marginTop: '20px' }}>
                    <button
                      type="button"
                      onClick={() => navigate(`/org/events?event=${feature.event.id}`)}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      Xem sự kiện →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Table Section: Cần bạn xử lý */}
          <div style={{ marginBottom: '32px' }}>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                fontWeight: 700,
                marginBottom: '16px',
              }}
            >
              Cần bạn xử lý
            </h2>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Filter toolbar */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div style={{ position: 'relative', maxWidth: '340px', width: '100%' }}>
                  <Search
                    size={16}
                    color="var(--muted)"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    type="text"
                    placeholder="Tìm trong danh sách"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '36px', height: '38px', fontSize: '13px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Filter size={14} color="var(--muted)" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ width: '190px', height: '38px', padding: '0 12px', fontSize: '13px' }}
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
                      <th style={{ padding: '12px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                        Đối tượng
                      </th>
                      <th style={{ padding: '12px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                        Chi tiết
                      </th>
                      <th style={{ padding: '12px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                        Trạng thái
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTodos.map((item) => (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom: '1px solid var(--border)',
                          transition: 'background-color 0.1s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => navigate(item.to)}
                      >
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                backgroundColor: 'var(--primary-tint)',
                                color: 'var(--primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Wallet size={16} />
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>
                              {item.title}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text)' }}>
                          {item.details}
                        </td>
                        <td style={{ padding: '16px 24px' }}>
                          <span className={`badge ${item.badge}`}>{item.status}</span>
                        </td>
                      </tr>
                    ))}
                    {!filteredTodos.length && (
                      <tr>
                        <td colSpan={3} style={{ padding: '24px', fontSize: 13, color: 'var(--muted)' }}>
                          Không có việc nào cần xử lý.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  padding: '12px 24px',
                  fontSize: '12px',
                  color: 'var(--muted)',
                  backgroundColor: 'var(--bg)',
                }}
              >
                {filteredTodos.length} bản ghi
              </div>
            </div>
          </div>

          {/* Primary Bottom Action */}
          <div>
            <button
              onClick={() => navigate('/org/events')}
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '15px' }}
            >
              <Plus size={18} />
              <span>Tạo sự kiện</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
