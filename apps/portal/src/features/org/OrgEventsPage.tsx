import { useState, type FormEvent } from 'react';
import { Calendar, Plus, Search, MapPin, Ticket, Clock, Trash2, X, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface TicketTier {
  id: string;
  name: string;
  price: string;
  total: number;
  sold: number;
}

export interface SessionItem {
  id: string;
  date: string;
  doorsOpen: string;
  startsAt: string;
  status: string;
}

interface EventItem {
  id: string;
  title: string;
  venue: string;
  category: string;
  startDate: string;
  sessionsCount: number;
  ticketsSold: number;
  totalTickets: number;
  revenue: string;
  status: 'Đang bán' | 'Sắp diễn' | 'Đã kết thúc';
  image: string;
  ticketTiers?: TicketTier[];
  sessions?: SessionItem[];
}

export function OrgEventsPage() {
  const [filter, setFilter] = useState<'all' | 'selling' | 'upcoming' | 'ended'>('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEventForTickets, setSelectedEventForTickets] = useState<EventItem | null>(null);
  const [selectedEventForSessions, setSelectedEventForSessions] = useState<EventItem | null>(null);
  const [ticketActionSuccess, setTicketActionSuccess] = useState<string | null>(null);

  // Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // New ticket tier form state
  const [newTierName, setNewTierName] = useState('');
  const [newTierPrice, setNewTierPrice] = useState('');
  const [newTierTotal, setNewTierTotal] = useState(50);

  // New session form state
  const [newSessionDate, setNewSessionDate] = useState('');
  const [newSessionDoors, setNewSessionDoors] = useState('18:30');
  const [newSessionStarts, setNewSessionStarts] = useState('19:30');

  const [events, setEvents] = useState<EventItem[]>([
    {
      id: 'EVT-01',
      title: 'Đêm nhạc Mùa Thu',
      venue: 'Nhà hát Ánh Trăng',
      category: 'Âm nhạc',
      startDate: '24/10/2026',
      sessionsCount: 2,
      ticketsSold: 64,
      totalTickets: 200,
      revenue: '23.400.000đ',
      status: 'Đang bán',
      image: '/assets/5468833387e5621c0a6d63465a517da248c8556d.jpg',
      ticketTiers: [
        { id: 'TT-01', name: 'Vé VIP - Khán đài A', price: '650.000 đ', total: 50, sold: 34 },
        { id: 'TT-02', name: 'Vé Tiêu chuẩn - Khán đài B', price: '350.000 đ', total: 100, sold: 30 },
        { id: 'TT-03', name: 'Vé Early Bird (Mở bán sớm)', price: '200.000 đ', total: 50, sold: 0 },
      ],
      sessions: [
        { id: 'SS-01', date: '24/10/2026', doorsOpen: '18:30', startsAt: '19:30', status: 'Sắp diễn' },
        { id: 'SS-02', date: '25/10/2026', doorsOpen: '18:30', startsAt: '19:30', status: 'Mở bán' },
      ],
    },
    {
      id: 'EVT-02',
      title: 'Hòa Nhạc Acoustic Bên Sông',
      venue: 'Rạp Sóng Việt',
      category: 'Âm nhạc',
      startDate: '05/11/2026',
      sessionsCount: 1,
      ticketsSold: 35,
      totalTickets: 120,
      revenue: '10.500.000đ',
      status: 'Sắp diễn',
      image: '/assets/2ba0a1dcc121100d3d8f109009a71fe5b0c24c83.jpg',
      ticketTiers: [
        { id: 'TT-04', name: 'Vé Ghế Đôi Sofa', price: '800.000 đ', total: 40, sold: 15 },
        { id: 'TT-05', name: 'Vé Thường Đơn', price: '300.000 đ', total: 80, sold: 20 },
      ],
      sessions: [
        { id: 'SS-03', date: '05/11/2026', doorsOpen: '19:00', startsAt: '20:00', status: 'Mở bán' },
      ],
    },
    {
      id: 'EVT-03',
      title: 'Lễ Hội Sân Khấu Kịch Trẻ',
      venue: 'Nhà hát Ánh Trăng',
      category: 'Kịch nói',
      startDate: '12/09/2026',
      sessionsCount: 3,
      ticketsSold: 280,
      totalTickets: 300,
      revenue: '42.000.000đ',
      status: 'Đã kết thúc',
      image: '/assets/4af2614f4438e6291e0ca8437781ac812c25ca05.jpg',
      ticketTiers: [
        { id: 'TT-06', name: 'Vé Hạng Nhất', price: '250.000 đ', total: 150, sold: 150 },
        { id: 'TT-07', name: 'Vé Phổ Thông', price: '150.000 đ', total: 150, sold: 130 },
      ],
      sessions: [
        { id: 'SS-04', date: '12/09/2026', doorsOpen: '18:30', startsAt: '19:30', status: 'Đã kết thúc' },
      ],
    },
  ]);

  // Form state for new event
  const [newEvent, setNewEvent] = useState({
    title: '',
    venue: 'Nhà hát Ánh Trăng',
    category: 'Âm nhạc',
    startDate: '',
    totalTickets: 100,
    price: '250.000đ',
  });

  const handleCreateEvent = (e: FormEvent) => {
    e.preventDefault();
    if (!newEvent.title) return;

    const created: EventItem = {
      id: `EVT-0${events.length + 1}`,
      title: newEvent.title,
      venue: newEvent.venue,
      category: newEvent.category,
      startDate: newEvent.startDate || '28/10/2026',
      sessionsCount: 1,
      ticketsSold: 0,
      totalTickets: Number(newEvent.totalTickets) || 100,
      revenue: '0đ',
      status: 'Đang bán',
      image: '/assets/5468833387e5621c0a6d63465a517da248c8556d.jpg',
    };

    setEvents([created, ...events]);
    setShowCreateModal(false);
    setNewEvent({
      title: '',
      venue: 'Nhà hát Ánh Trăng',
      category: 'Âm nhạc',
      startDate: '',
      totalTickets: 100,
      price: '250.000đ',
    });
  };

  const filteredEvents = events.filter((evt) => {
    const matchSearch =
      evt.title.toLowerCase().includes(search.toLowerCase()) ||
      evt.venue.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'selling') return evt.status === 'Đang bán';
    if (filter === 'upcoming') return evt.status === 'Sắp diễn';
    if (filter === 'ended') return evt.status === 'Đã kết thúc';
    return true;
  });

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Page Title & Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <span className="tag-overline">QUẢN LÝ SỰ KIỆN</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Sự kiện của tôi
          </h1>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
          style={{ padding: '12px 22px', fontSize: '14px' }}
        >
          <Plus size={18} />
          <span>Tạo sự kiện mới</span>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          {(
            [
              { id: 'all', label: 'Tất cả sự kiện' },
              { id: 'selling', label: 'Đang bán' },
              { id: 'upcoming', label: 'Sắp diễn' },
              { id: 'ended', label: 'Đã kết thúc' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid',
                borderColor: filter === tab.id ? 'var(--primary)' : 'var(--border)',
                backgroundColor: filter === tab.id ? 'var(--primary-tint)' : 'var(--surface)',
                color: filter === tab.id ? 'var(--primary)' : 'var(--text)',
                fontWeight: filter === tab.id ? 600 : 500,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '320px' }}>
          <Search
            size={16}
            color="var(--muted)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Tìm theo tên sự kiện hoặc địa điểm…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: '36px', height: '40px', fontSize: '13px' }}
          />
        </div>
      </div>

      {/* Events Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {filteredEvents.map((evt) => (
          <div
            key={evt.id}
            className="card"
            style={{
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            }}
          >
            <div>
              {/* Event Image Banner */}
              <div
                style={{
                  height: '160px',
                  backgroundImage: `url('${evt.image}')`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  className={`badge ${
                    evt.status === 'Đang bán'
                      ? 'badge-warning'
                      : evt.status === 'Sắp diễn'
                      ? 'badge-info'
                      : 'badge-tint'
                  }`}
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                >
                  {evt.status}
                </span>

                <span
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    padding: '4px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                >
                  {evt.category}
                </span>
              </div>

              {/* Event Content */}
              <div style={{ padding: '20px 24px' }}>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '18px',
                    fontWeight: 700,
                    marginBottom: '10px',
                    color: 'var(--text)',
                  }}
                >
                  {evt.title}
                </h3>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '13px',
                    color: 'var(--muted)',
                    marginBottom: '18px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MapPin size={15} color="var(--primary)" />
                    <span>{evt.venue}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={15} color="var(--primary)" />
                    <span>Ngày diễn: {evt.startDate} ({evt.sessionsCount} suất)</span>
                  </div>
                </div>

                {/* Progress bar of ticket sales */}
                <div style={{ marginBottom: '16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ color: 'var(--muted)' }}>Đã bán:</span>
                    <strong>
                      {evt.ticketsSold} / {evt.totalTickets} vé
                    </strong>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'var(--surface-alt)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(100, (evt.ticketsSold / evt.totalTickets) * 100)}%`,
                        backgroundColor: 'var(--primary)',
                        borderRadius: '999px',
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border)',
                    fontSize: '13px',
                  }}
                >
                  <span style={{ color: 'var(--muted)' }}>Doanh thu ghi nhận:</span>
                  <strong style={{ color: 'var(--text)' }}>{evt.revenue}</strong>
                </div>
              </div>
            </div>

            {/* Actions Footer */}
            <div
              style={{
                padding: '12px 24px',
                backgroundColor: 'var(--bg)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <button
                className="btn btn-outline"
                style={{ fontSize: '13px', padding: '6px 14px' }}
                onClick={() => {
                  setSelectedEventForSessions(evt);
                  setTicketActionSuccess(null);
                }}
              >
                Quản lý suất diễn
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: '13px', padding: '6px 12px', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  onClick={() => {
                    setSelectedEventForTickets(evt);
                    setTicketActionSuccess(null);
                  }}
                >
                  <Ticket size={14} />
                  Cấu hình vé
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirm({
                      title: 'Xác nhận xóa sự kiện?',
                      message: `Bạn có chắc chắn muốn xóa sự kiện "${evt.title}" không? Toàn bộ suất diễn và các hạng vé liên quan sẽ bị xóa khỏi hệ thống.`,
                      onConfirm: () => {
                        setEvents(events.filter((e) => e.id !== evt.id));
                        setDeleteConfirm(null);
                      },
                    });
                  }}
                  className="btn-ghost"
                  style={{ color: 'var(--muted)', padding: '6px 8px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '4px' }}
                  title="Xóa sự kiện"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Create Event */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: 'var(--surface)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '22px',
                fontWeight: 700,
                marginBottom: '8px',
              }}
            >
              Tạo sự kiện mới
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
              Nhập các thông tin cơ bản để bắt đầu mở bán vé sự kiện.
            </p>

            <form onSubmit={handleCreateEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label>
                Tên sự kiện *
                <input
                  type="text"
                  placeholder="Ví dụ: Đêm nhạc Mùa Thu 2026"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label>
                  Thể loại
                  <select
                    value={newEvent.category}
                    onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value })}
                  >
                    <option value="Âm nhạc">Âm nhạc</option>
                    <option value="Kịch nói">Kịch nói</option>
                    <option value="Hội thảo">Hội thảo</option>
                    <option value="Thể thao">Thể thao</option>
                  </select>
                </label>

                <label>
                  Địa điểm tổ chức
                  <select
                    value={newEvent.venue}
                    onChange={(e) => setNewEvent({ ...newEvent, venue: e.target.value })}
                  >
                    <option value="Nhà hát Ánh Trăng">Nhà hát Ánh Trăng</option>
                    <option value="Rạp Sóng Việt">Rạp Sóng Việt</option>
                    <option value="Sân vận động Quân Khu 7">Sân vận động Quân Khu 7</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label>
                  Ngày diễn
                  <input
                    type="date"
                    value={newEvent.startDate}
                    onChange={(e) => setNewEvent({ ...newEvent, startDate: e.target.value })}
                  />
                </label>

                <label>
                  Tổng số vé dự kiến
                  <input
                    type="number"
                    min="10"
                    value={newEvent.totalTickets}
                    onChange={(e) => setNewEvent({ ...newEvent, totalTickets: Number(e.target.value) })}
                  />
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-outline"
                >
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu & Mở bán
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Configure Ticket Tiers */}
      {selectedEventForTickets && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '680px',
              backgroundColor: 'var(--surface)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '16px',
                marginBottom: '20px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Cấu hình vé & Giá bán
                </div>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    margin: '4px 0 0',
                    color: 'var(--text)',
                  }}
                >
                  {selectedEventForTickets.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedEventForTickets(null)}
                className="btn-ghost"
                style={{ padding: '6px', cursor: 'pointer', border: 'none', background: 'none' }}
              >
                <X size={20} color="var(--muted)" />
              </button>
            </div>

            {ticketActionSuccess && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--success-bg)',
                  color: 'var(--success)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontSize: '13.5px',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{ticketActionSuccess}</span>
              </div>
            )}

            {/* List of current ticket tiers */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
                Các hạng vé hiện có ({selectedEventForTickets.ticketTiers?.length || 0})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedEventForTickets.ticketTiers?.map((tier) => (
                  <div
                    key={tier.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      backgroundColor: 'var(--surface-alt)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '16px',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <Ticket size={16} color="var(--primary)" />
                        <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{tier.name}</strong>
                        <span className="badge badge-tint" style={{ fontWeight: 700 }}>
                          {tier.price}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                        <span>Đã bán: <strong>{tier.sold}</strong> / {tier.total} vé</span>
                        <div
                          style={{
                            flex: 1,
                            maxWidth: '180px',
                            height: '6px',
                            backgroundColor: 'var(--border)',
                            borderRadius: '999px',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              width: `${Math.min(100, (tier.sold / tier.total) * 100)}%`,
                              backgroundColor: 'var(--primary)',
                              borderRadius: '999px',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setDeleteConfirm({
                          title: 'Xóa hạng vé này?',
                          message: `Bạn có chắc muốn xóa hạng vé "${tier.name}" (${tier.price}) không? Thao tác này sẽ hủy số vé phân bổ cho hạng vé này.`,
                          onConfirm: () => {
                            const updatedTiers = selectedEventForTickets.ticketTiers?.filter((t) => t.id !== tier.id);
                            setSelectedEventForTickets({ ...selectedEventForTickets, ticketTiers: updatedTiers });
                            setEvents(events.map((e) => e.id === selectedEventForTickets.id ? { ...e, ticketTiers: updatedTiers } : e));
                            setDeleteConfirm(null);
                            setTicketActionSuccess(`Đã xóa hạng vé "${tier.name}"!`);
                          },
                        });
                      }}
                      className="btn-ghost"
                      style={{ color: 'var(--danger)', padding: '6px', border: 'none', background: 'none', cursor: 'pointer' }}
                      title="Xóa hạng vé"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Add New Ticket Tier */}
            <div
              style={{
                border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                backgroundColor: 'var(--bg)',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={15} color="var(--primary)" />
                Thêm hạng vé mới
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr auto', gap: '10px', alignItems: 'flex-end' }}>
                <label style={{ fontSize: '12px' }}>
                  Tên hạng vé
                  <input
                    type="text"
                    placeholder="VD: VIP Khán đài A"
                    value={newTierName}
                    onChange={(e) => setNewTierName(e.target.value)}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </label>

                <label style={{ fontSize: '12px' }}>
                  Giá vé (VNĐ)
                  <input
                    type="text"
                    placeholder="VD: 500.000 đ"
                    value={newTierPrice}
                    onChange={(e) => setNewTierPrice(e.target.value)}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </label>

                <label style={{ fontSize: '12px' }}>
                  Số lượng
                  <input
                    type="number"
                    min="1"
                    value={newTierTotal}
                    onChange={(e) => setNewTierTotal(Number(e.target.value))}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    if (!newTierName || !newTierPrice) return;
                    const newTier: TicketTier = {
                      id: `TT-${Date.now().toString().slice(-4)}`,
                      name: newTierName,
                      price: newTierPrice.endsWith('đ') ? newTierPrice : `${newTierPrice} đ`,
                      total: newTierTotal,
                      sold: 0,
                    };
                    const updatedTiers = [...(selectedEventForTickets.ticketTiers || []), newTier];
                    setSelectedEventForTickets({ ...selectedEventForTickets, ticketTiers: updatedTiers });
                    setEvents(events.map((e) => e.id === selectedEventForTickets.id ? { ...e, ticketTiers: updatedTiers } : e));
                    setNewTierName('');
                    setNewTierPrice('');
                    setNewTierTotal(50);
                    setTicketActionSuccess('Đã thêm hạng vé mới thành công!');
                  }}
                  className="btn btn-outline"
                  style={{ height: '36px', fontSize: '13px', padding: '0 14px' }}
                >
                  Thêm
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid var(--border)',
                paddingTop: '16px',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedEventForTickets(null)}
                className="btn btn-outline"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={() => {
                  setTicketActionSuccess('Đã lưu toàn bộ cấu hình hạng vé thành công!');
                  setTimeout(() => setSelectedEventForTickets(null), 1000);
                }}
                className="btn btn-primary"
              >
                Lưu cấu hình vé
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Manage Sessions */}
      {selectedEventForSessions && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '640px',
              backgroundColor: 'var(--surface)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '16px',
                marginBottom: '20px',
              }}
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Quản lý suất diễn (Sessions)
                </div>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    margin: '4px 0 0',
                    color: 'var(--text)',
                  }}
                >
                  {selectedEventForSessions.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedEventForSessions(null)}
                className="btn-ghost"
                style={{ padding: '6px', cursor: 'pointer', border: 'none', background: 'none' }}
              >
                <X size={20} color="var(--muted)" />
              </button>
            </div>

            {/* List of current sessions */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
                Danh sách suất diễn ({selectedEventForSessions.sessions?.length || 0})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedEventForSessions.sessions?.map((ss) => (
                  <div
                    key={ss.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      backgroundColor: 'var(--surface-alt)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <Calendar size={15} color="var(--primary)" />
                        <strong style={{ fontSize: '13.5px', color: 'var(--text)' }}>Ngày: {ss.date}</strong>
                        <span className="badge badge-info">{ss.status}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} /> Mở cửa: {ss.doorsOpen}
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} /> Biểu diễn: {ss.startsAt}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setDeleteConfirm({
                          title: 'Xóa suất diễn này?',
                          message: `Bạn có chắc muốn xóa suất diễn ngày ${ss.date} (bắt đầu lúc ${ss.startsAt}) không?`,
                          onConfirm: () => {
                            const updatedSessions = selectedEventForSessions.sessions?.filter((s) => s.id !== ss.id);
                            setSelectedEventForSessions({ ...selectedEventForSessions, sessions: updatedSessions });
                            setEvents(events.map((e) => e.id === selectedEventForSessions.id ? { ...e, sessions: updatedSessions, sessionsCount: updatedSessions?.length || 0 } : e));
                            setDeleteConfirm(null);
                          },
                        });
                      }}
                      className="btn-ghost"
                      style={{ color: 'var(--danger)', padding: '6px', border: 'none', background: 'none', cursor: 'pointer' }}
                      title="Xóa suất diễn"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add New Session */}
            <div
              style={{
                border: '1px dashed var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                backgroundColor: 'var(--bg)',
                marginBottom: '20px',
              }}
            >
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={15} color="var(--primary)" />
                Thêm suất diễn mới
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                <label style={{ fontSize: '12px' }}>
                  Ngày diễn
                  <input
                    type="date"
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </label>

                <label style={{ fontSize: '12px' }}>
                  Giờ mở cửa
                  <input
                    type="time"
                    value={newSessionDoors}
                    onChange={(e) => setNewSessionDoors(e.target.value)}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </label>

                <label style={{ fontSize: '12px' }}>
                  Giờ bắt đầu
                  <input
                    type="time"
                    value={newSessionStarts}
                    onChange={(e) => setNewSessionStarts(e.target.value)}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    if (!newSessionDate) return;
                    const newSs: SessionItem = {
                      id: `SS-${Date.now().toString().slice(-4)}`,
                      date: newSessionDate,
                      doorsOpen: newSessionDoors,
                      startsAt: newSessionStarts,
                      status: 'Mở bán',
                    };
                    const updatedSessions = [...(selectedEventForSessions.sessions || []), newSs];
                    setSelectedEventForSessions({ ...selectedEventForSessions, sessions: updatedSessions });
                    setEvents(events.map((e) => e.id === selectedEventForSessions.id ? { ...e, sessions: updatedSessions, sessionsCount: updatedSessions.length } : e));
                    setNewSessionDate('');
                  }}
                  className="btn btn-outline"
                  style={{ height: '36px', fontSize: '13px', padding: '0 14px' }}
                >
                  Thêm
                </button>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                borderTop: '1px solid var(--border)',
                paddingTop: '16px',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedEventForSessions(null)}
                className="btn btn-primary"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: '28px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--danger-bg, #fee2e2)',
                color: 'var(--danger, #dc2626)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '19px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: '0 0 8px',
              }}
            >
              {deleteConfirm.title}
            </h3>

            <p
              style={{
                fontSize: '13.5px',
                color: 'var(--muted)',
                lineHeight: 1.5,
                margin: '0 0 24px',
              }}
            >
              {deleteConfirm.message}
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}
            >
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="btn btn-outline"
                style={{ flex: 1, padding: '10px 16px' }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={deleteConfirm.onConfirm}
                className="btn"
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  backgroundColor: 'var(--danger, #dc2626)',
                  color: '#ffffff',
                  borderColor: 'var(--danger, #dc2626)',
                }}
              >
                Đồng ý xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
