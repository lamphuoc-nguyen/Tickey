import { useState } from 'react';
import { Plus, Grid3X3, Users } from 'lucide-react';

export function OrgVenuesPage() {
  const [selectedVenue, setSelectedVenue] = useState('v1');

  const venues = [
    {
      id: 'v1',
      name: 'Nhà hát Ánh Trăng',
      address: 'Số 120 Hai Bà Trưng, Quận 1, TP.HCM',
      capacity: 500,
      type: 'Nhà hát kịch nghệ & hòa nhạc',
      status: 'Đã xác minh',
      zones: [
        { name: 'Khu VIP (Hàng A - C)', seats: 60, price: '850.000đ', color: '#D9422D' },
        { name: 'Khu Standard (Hàng D - J)', seats: 240, price: '450.000đ', color: '#315D99' },
        { name: 'Khu Balcony Tầng 2', seats: 120, price: '250.000đ', color: '#1B7956' },
        { name: 'Khu đứng (Standing)', seats: 80, price: '180.000đ', color: '#946018' },
      ],
    },
    {
      id: 'v2',
      name: 'Rạp Sóng Việt',
      address: 'Bến Bạch Đằng, Quận 1, TP.HCM',
      capacity: 350,
      type: 'Sân khấu ngoài trời bên sông',
      status: 'Chờ duyệt',
      zones: [
        { name: 'Khu Bàn Tròn VIP', seats: 50, price: '600.000đ', color: '#D9422D' },
        { name: 'Khu Ghế Thường', seats: 200, price: '300.000đ', color: '#315D99' },
        { name: 'Khu Đứng Thưởng Cảnh', seats: 100, price: '150.000đ', color: '#946018' },
      ],
    },
  ];

  const currentVenue = venues.find((v) => v.id === selectedVenue) || venues[0];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
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
          <span className="tag-overline">ĐỊA ĐIỂM & SƠ ĐỒ</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Địa điểm tổ chức & Sơ đồ ghế
          </h1>
        </div>

        <button
          onClick={() => alert('Chức năng thêm địa điểm mới đang được kết nối với hồ sơ giấy phép')}
          className="btn btn-primary"
        >
          <Plus size={18} />
          <span>Thêm địa điểm mới</span>
        </button>
      </div>

      {/* Venues Selector Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        {venues.map((v) => {
          const isSelected = v.id === selectedVenue;
          return (
            <div
              key={v.id}
              onClick={() => setSelectedVenue(v.id)}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                backgroundColor: isSelected ? 'var(--surface)' : 'var(--surface)',
                boxShadow: isSelected ? '0 0 0 2px var(--primary-tint)' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '18px',
                    fontWeight: 700,
                    margin: 0,
                    color: 'var(--text)',
                  }}
                >
                  {v.name}
                </h3>
                <span
                  className={`badge ${v.status === 'Đã xác minh' ? 'badge-success' : 'badge-warning'}`}
                >
                  {v.status}
                </span>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px' }}>
                {v.address}
              </p>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  fontSize: '13px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} color="var(--primary)" />
                  <span>Sức chứa: <strong>{v.capacity}</strong> chỗ</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Grid3X3 size={16} color="var(--primary)" />
                  <span><strong>{v.zones.length}</strong> phân khu</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Seat Map Visualizer */}
      <div className="card" style={{ padding: '32px', marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '20px',
                fontWeight: 700,
                margin: '0 0 4px',
              }}
            >
              Sơ đồ bố trí: {currentVenue.name}
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Mô hình trực quan các khu vực khán giả và sân khấu
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => alert('Mở trình chỉnh sửa sơ đồ ghế (o-layout-editor)')}
              className="btn btn-outline"
              style={{ fontSize: '13px' }}
            >
              Chỉnh sửa sơ đồ
            </button>
            <button
              onClick={() => alert('Khóa/Chặn ghế bán theo đợt')}
              className="btn btn-outline"
              style={{ fontSize: '13px' }}
            >
              Giữ chỗ / Chặn ghế
            </button>
          </div>
        </div>

        {/* Stage & Grid representation */}
        <div
          style={{
            backgroundColor: 'var(--bg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '36px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Stage Element */}
          <div
            style={{
              width: '65%',
              maxWidth: '480px',
              backgroundColor: 'var(--navy)',
              color: '#FFFFFF',
              textAlign: 'center',
              padding: '12px',
              borderRadius: '8px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.08em',
              marginBottom: '36px',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            SÂN KHẤU TRUNG TÂM (STAGE)
          </div>

          {/* Zones Layout Representation */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              width: '100%',
              maxWidth: '560px',
            }}
          >
            {currentVenue.zones.map((zone) => (
              <div
                key={zone.name}
                style={{
                  border: `2px solid ${zone.color}`,
                  borderRadius: '10px',
                  backgroundColor: 'var(--surface)',
                  padding: '16px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: zone.color,
                    }}
                  />
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--text)' }}>
                      {zone.name}
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {zone.seats} chỗ ngồi
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: zone.color }}>
                    {zone.price}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Giá tham khảo</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
