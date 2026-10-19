import { useState, type FormEvent } from 'react';
import { Calendar, Plus, Search, MapPin } from 'lucide-react';

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
}

export function OrgEventsPage() {
  const [filter, setFilter] = useState<'all' | 'selling' | 'upcoming' | 'ended'>('all');
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

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
                onClick={() => alert(`Xem chi tiết sự kiện ${evt.title}`)}
              >
                Quản lý suất diễn
              </button>
              <button
                className="btn btn-ghost"
                style={{ fontSize: '13px', padding: '6px 10px', color: 'var(--primary)' }}
                onClick={() => alert(`Cấu hình hạng vé cho ${evt.title}`)}
              >
                Cấu hình vé
              </button>
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
    </div>
  );
}
