import { useState } from 'react';
import {
  Clock,
  CreditCard,
  FileText,
  Filter,
  Plus,
  Search,
  Ticket,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router';

export function OrgHomePage() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // Weekly ticket sales mock data matching Figma
  const salesDays = [
    { day: '01', height: 40, active: false },
    { day: '02', height: 60, active: false },
    { day: '03', height: 48, active: false },
    { day: '04', height: 75, active: false },
    { day: '05', height: 85, active: false },
    { day: '06', height: 65, active: false },
    { day: '07', height: 110, active: true },
  ];

  // Action items matching Figma
  const actionItems = [
    {
      id: '1',
      title: 'Đêm nhạc Mùa Thu / Đêm 1',
      details: '24/10 • 19:30',
      status: 'Đang bán',
      statusType: 'warning',
    },
    {
      id: '2',
      title: 'Đêm nhạc Mùa Thu / Đêm 2',
      details: '25/10 • 19:30',
      status: 'Đang bán',
      statusType: 'warning',
    },
  ];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header Title */}
        <div style={{ marginBottom: '28px' }}>
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
            Tổng quan tổ chức
          </h1>
        </div>

        {/* 4 Stat Cards Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
            gap: '20px',
            marginBottom: '28px',
          }}
        >
          {/* Card 1 */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                Vé phát hành · 3 suất sắp diễn
              </span>
              <Ticket size={18} color="var(--primary)" />
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '36px',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '8px',
              }}
            >
              64
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Cập nhật lúc 10:42</div>
          </div>

          {/* Card 2 */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                Doanh thu ghi nhận
              </span>
              <CreditCard size={18} color="var(--primary)" />
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
              23.400.000đ
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Cập nhật lúc 10:42</div>
          </div>

          {/* Card 3 */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                Suất sắp diễn
              </span>
              <Users size={18} color="var(--primary)" />
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '36px',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '8px',
              }}
            >
              3
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Cập nhật lúc 10:42</div>
          </div>

          {/* Card 4 */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
              }}
            >
              <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 500 }}>
                Việc cần xử lý
              </span>
              <Clock size={18} color="var(--primary)" />
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '36px',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '8px',
              }}
            >
              3
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Cập nhật lúc 10:42</div>
          </div>
        </div>

        {/* Middle Row: Sales Chart + Featured Event Card */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)',
            gap: '24px',
            marginBottom: '36px',
          }}
        >
          {/* Sales Activity Chart Card */}
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
                Nhịp bán vé trong tuần
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>01/10 - 07/10/2026</p>
            </div>

            {/* Bar Chart Visualization */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                height: '160px',
                paddingTop: '20px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {salesDays.map((col) => (
                <div
                  key={col.day}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: `${col.height}px`,
                      borderRadius: '6px 6px 0 0',
                      backgroundColor: col.active ? 'var(--primary)' : 'var(--primary-tint)',
                      transition: 'height 0.3s ease',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500 }}>
                    {col.day}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Featured Event Card */}
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
            <div
              style={{
                height: '170px',
                backgroundImage: `url('/assets/5468833387e5621c0a6d63465a517da248c8556d.jpg')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div
              style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                flex: 1,
                color: '#FFFFFF',
              }}
            >
              <div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    marginBottom: '8px',
                  }}
                >
                  Đêm nhạc Mùa Thu
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
                  24/10 · 19:30 · Nhà hát Ánh Trăng
                </p>
              </div>

              <div style={{ marginTop: '20px' }}>
                <button
                  onClick={() => navigate('/org/events')}
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

              <div>
                <button
                  className="btn btn-outline"
                  style={{ padding: '8px 14px', fontSize: '13px', height: '38px' }}
                >
                  <Filter size={14} />
                  <span>Tất cả trạng thái</span>
                </button>
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
                  {actionItems.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        transition: 'background-color 0.1s ease',
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate('/org/events')}
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
                            <FileText size={16} />
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
                        <span className="badge badge-warning">{item.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div
              style={{
                padding: '12px 24px',
                fontSize: '12px',
                color: 'var(--muted)',
                backgroundColor: 'var(--bg)',
              }}
            >
              2 bản ghi · Dữ liệu minh họa
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
      </div>
  );
}
