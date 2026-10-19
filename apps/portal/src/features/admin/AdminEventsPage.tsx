import {
  Calendar,
  CheckCircle2,
  Eye,
  FileCheck,
  MapPin,
  Search,
  Users,
} from 'lucide-react';
import { useState } from 'react';

interface EventItem {
  id: string;
  name: string;
  organizer: string;
  venue: string;
  dateTime: string;
  capacity: string;
  ticketPriceRange: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  permitStatus: string;
}

export function AdminEventsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [events, setEvents] = useState<EventItem[]>([
    {
      id: 'EV-091',
      name: 'Đêm nhạc Mùa Thu - Live in Saigon',
      organizer: 'Sóng Việt Events',
      venue: 'Nhà hát Hòa Bình, 240 Đường 3/2, Q.10, TP.HCM',
      dateTime: '15/11/2026 · 19:30',
      capacity: '2,500 vé',
      ticketPriceRange: '450.000đ - 1.800.000đ',
      status: 'PENDING',
      permitStatus: 'Đã đính kèm giấy phép Sở VHTT số 281/GP-SVHTT',
    },
    {
      id: 'EV-088',
      name: 'Hòa nhạc Giao hưởng Hoàng Gia',
      organizer: 'Royal Music Vietnam',
      venue: 'Nhà hát Lớn Hà Nội, 1 Tràng Tiền, Hoàn Kiếm, HN',
      dateTime: '20/11/2026 · 20:00',
      capacity: '600 vé',
      ticketPriceRange: '800.000đ - 3.200.000đ',
      status: 'PENDING',
      permitStatus: 'Đã đính kèm công văn chấp thuận địa điểm biểu diễn',
    },
    {
      id: 'EV-075',
      name: 'Rock Fest 2026: Sức Sống Tuổi Trẻ',
      organizer: 'Saigon Live Concerts',
      venue: 'Sân vận động Quân khu 7, TP.HCM',
      dateTime: '05/12/2026 · 18:00',
      capacity: '12,000 vé',
      ticketPriceRange: '350.000đ - 950.000đ',
      status: 'PENDING',
      permitStatus: 'Chờ bổ sung phương án PCCC và cứu thương',
    },
    {
      id: 'EV-062',
      name: 'Indie Soul Acoustic Night',
      organizer: 'Ánh Trăng Events',
      venue: 'Soul Live Project Complex, Q.3, TP.HCM',
      dateTime: '02/11/2026 · 19:00',
      capacity: '350 vé',
      ticketPriceRange: '300.000đ - 550.000đ',
      status: 'APPROVED',
      permitStatus: 'Đã hoàn tất kiểm duyệt pháp lý',
    },
  ]);

  const filtered = events.filter((e) => {
    if (!searchTerm) return true;
    return (
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.organizer.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleApprove = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'APPROVED' } : e))
    );
    setSelectedEvent(null);
    setActionSuccess('Đã phê duyệt sự kiện. Ban tổ chức đã có thể mở bán vé trên Tickey Marketplace!');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleReject = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'REJECTED' } : e))
    );
    setSelectedEvent(null);
    setActionSuccess('Đã từ chối kiểm duyệt sự kiện.');
    setTimeout(() => setActionSuccess(null), 4000);
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}
        >
          TICKEY / ADMIN / EVENTS
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Kiểm duyệt sự kiện
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
          Thẩm tra giấy phép biểu diễn, sơ đồ phân hạng vé và cam kết an toàn trước khi kích hoạt mở bán vé.
        </p>
      </div>

      {actionSuccess && (
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            width: '320px',
          }}
        >
          <Search size={16} color="var(--muted)" />
          <input
            type="text"
            placeholder="Tìm theo tên sự kiện, nhà tổ chức…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: '13px',
              width: '100%',
            }}
          />
        </div>

        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Hiển thị <strong>{filtered.length}</strong> sự kiện
        </div>
      </div>

      {/* Events List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {filtered.map((item) => (
          <div
            key={item.id}
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    fontFamily: 'monospace',
                  }}
                >
                  {item.id}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    backgroundColor: 'var(--primary-tint)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {item.organizer}
                </span>
                {item.status === 'PENDING' && <span className="badge badge-warning">Chờ kiểm duyệt</span>}
                {item.status === 'APPROVED' && <span className="badge badge-success">Đang mở bán</span>}
                {item.status === 'REJECTED' && <span className="badge badge-danger">Từ chối</span>}
              </div>

              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: '0 0 10px',
                  color: 'var(--text)',
                }}
              >
                {item.name}
              </h3>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  fontSize: '13px',
                  color: 'var(--muted)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} color="var(--primary)" />
                  <span>{item.dateTime}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={15} color="var(--primary)" />
                  <span>{item.venue}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="var(--primary)" />
                  <span>{item.capacity}</span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)' }}>
                {item.ticketPriceRange}
              </div>
              <button
                onClick={() => setSelectedEvent(item)}
                className="btn btn-primary"
                style={{ fontSize: '13px', padding: '8px 16px' }}
              >
                <Eye size={14} style={{ marginRight: '6px' }} />
                Kiểm duyệt chi tiết
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Review Event Modal (a-event-review) */}
      {selectedEvent && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '720px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              padding: '32px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  KIỂM DUYỆT SỰ KIỆN · {selectedEvent.id}
                </span>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '22px',
                    fontWeight: 700,
                    margin: '4px 0 0',
                    color: 'var(--text)',
                  }}
                >
                  {selectedEvent.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="btn-ghost"
                style={{ fontSize: '18px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '28px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Nhà tổ chức</div>
                  <strong style={{ fontSize: '15px', color: 'var(--text)' }}>{selectedEvent.organizer}</strong>
                </div>
                <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Thời gian tổ chức</div>
                  <strong style={{ fontSize: '15px', color: 'var(--text)' }}>{selectedEvent.dateTime}</strong>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Địa điểm & Sức chứa</div>
                <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{selectedEvent.venue}</strong>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  Tổng quy mô phát hành: <strong>{selectedEvent.capacity}</strong>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                  Pháp lý & Giấy phép biểu diễn
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)', fontSize: '13px' }}>
                  <FileCheck size={16} color="var(--success)" />
                  <span>{selectedEvent.permitStatus}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => handleReject(selectedEvent.id)}
                className="btn btn-outline"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '13px' }}
              >
                Từ chối sự kiện
              </button>
              <button
                onClick={() => handleApprove(selectedEvent.id)}
                className="btn btn-primary"
                style={{ fontSize: '13px' }}
              >
                Phê duyệt mở bán vé
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
