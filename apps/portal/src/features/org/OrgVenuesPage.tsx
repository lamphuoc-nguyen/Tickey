import { useState } from 'react';
import {
  Plus,
  Grid3X3,
  Users,
  MapPin,
  Lock,
  ShieldAlert,
  CheckCircle2,
  X,
  Trash2,
  Sliders,
  AlertTriangle,
} from 'lucide-react';

export interface ZoneItem {
  id: string;
  name: string;
  seats: number;
  price: string;
  color: string;
}

export interface VenueItem {
  id: string;
  name: string;
  address: string;
  capacity: number;
  type: string;
  status: 'Đã xác minh' | 'Chờ duyệt' | 'Mới tạo';
  zones: ZoneItem[];
}

export interface HoldRule {
  id: string;
  venueId: string;
  zoneName: string;
  seatsCount: number;
  type: 'BLOCK' | 'HOLD_COMP';
  reason: string;
  createdAt: string;
}

export function OrgVenuesPage() {
  const [venues, setVenues] = useState<VenueItem[]>([
    {
      id: 'v1',
      name: 'Nhà hát Ánh Trăng',
      address: 'Số 120 Hai Bà Trưng, Quận 1, TP.HCM',
      capacity: 500,
      type: 'Nhà hát kịch nghệ & hòa nhạc',
      status: 'Đã xác minh',
      zones: [
        { id: 'z1', name: 'Khu VIP (Hàng A - C)', seats: 60, price: '850.000đ', color: '#D9422D' },
        { id: 'z2', name: 'Khu Standard (Hàng D - J)', seats: 240, price: '450.000đ', color: '#315D99' },
        { id: 'z3', name: 'Khu Balcony Tầng 2', seats: 120, price: '250.000đ', color: '#1B7956' },
        { id: 'z4', name: 'Khu đứng (Standing)', seats: 80, price: '180.000đ', color: '#946018' },
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
        { id: 'z5', name: 'Khu Bàn Tròn VIP', seats: 50, price: '600.000đ', color: '#D9422D' },
        { id: 'z6', name: 'Khu Ghế Thường', seats: 200, price: '300.000đ', color: '#315D99' },
        { id: 'z7', name: 'Khu Đứng Thưởng Cảnh', seats: 100, price: '150.000đ', color: '#946018' },
      ],
    },
  ]);

  const [selectedVenueId, setSelectedVenueId] = useState('v1');
  const currentVenue = venues.find((v) => v.id === selectedVenueId) || venues[0];

  // Hold / Block Seat Rules
  const [holdRules, setHoldRules] = useState<HoldRule[]>([
    {
      id: 'HR-01',
      venueId: 'v1',
      zoneName: 'Khu VIP (Hàng A - C)',
      seatsCount: 12,
      type: 'HOLD_COMP',
      reason: 'Ghế đại biểu danh dự & Nhà tài trợ kim cương',
      createdAt: '20/10/2026',
    },
    {
      id: 'HR-02',
      venueId: 'v1',
      zoneName: 'Khu Standard (Hàng D - J)',
      seatsCount: 8,
      type: 'BLOCK',
      reason: 'Khu vực đặt hệ thống camera truyền hình & âm thanh',
      createdAt: '20/10/2026',
    },
  ]);

  // Modal States
  const [showAddVenueModal, setShowAddVenueModal] = useState(false);
  const [showEditLayoutModal, setShowEditLayoutModal] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // New Venue Form State
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueAddress, setNewVenueAddress] = useState('');
  const [newVenueType, setNewVenueType] = useState('Khán phòng sự kiện');
  const [newVenueCapacity, setNewVenueCapacity] = useState(300);

  // New Zone Form State (Inside Edit Layout Modal)
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneSeats, setNewZoneSeats] = useState(50);
  const [newZonePrice, setNewZonePrice] = useState('350.000đ');
  const [newZoneColor, setNewZoneColor] = useState('#D9422D');

  // New Hold Rule Form State (Inside Hold/Block Modal)
  const [holdZoneName, setHoldZoneName] = useState(currentVenue.zones[0]?.name || '');
  const [holdSeatsCount, setHoldSeatsCount] = useState(10);
  const [holdType, setHoldType] = useState<'BLOCK' | 'HOLD_COMP'>('HOLD_COMP');
  const [holdReason, setHoldReason] = useState('Ghế khách mời VIP');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Handle Add New Venue
  const handleAddVenue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenueName || !newVenueAddress) return;

    const newVenue: VenueItem = {
      id: `v${venues.length + 1}`,
      name: newVenueName,
      address: newVenueAddress,
      capacity: newVenueCapacity,
      type: newVenueType,
      status: 'Mới tạo',
      zones: [
        { id: `z_${Date.now()}_1`, name: 'Khu Khán Đài VIP', seats: Math.floor(newVenueCapacity * 0.2), price: '750.000đ', color: '#D9422D' },
        { id: `z_${Date.now()}_2`, name: 'Khu Phổ Thông', seats: Math.floor(newVenueCapacity * 0.8), price: '350.000đ', color: '#315D99' },
      ],
    };

    setVenues([...venues, newVenue]);
    setSelectedVenueId(newVenue.id);
    setShowAddVenueModal(false);
    setNewVenueName('');
    setNewVenueAddress('');
    triggerToast(`Đã tạo địa điểm "${newVenue.name}" thành công!`);
  };

  // Handle Add Zone to Current Venue
  const handleAddZone = () => {
    if (!newZoneName) return;

    const newZone: ZoneItem = {
      id: `z_${Date.now()}`,
      name: newZoneName,
      seats: newZoneSeats,
      price: newZonePrice.endsWith('đ') ? newZonePrice : `${newZonePrice}đ`,
      color: newZoneColor,
    };

    const updatedZones = [...currentVenue.zones, newZone];
    const updatedCapacity = updatedZones.reduce((sum, z) => sum + z.seats, 0);

    setVenues(
      venues.map((v) =>
        v.id === currentVenue.id ? { ...v, zones: updatedZones, capacity: updatedCapacity } : v,
      ),
    );

    setNewZoneName('');
    setNewZoneSeats(50);
    triggerToast(`Đã thêm phân khu "${newZone.name}" vào sơ đồ!`);
  };

  // Handle Add Hold / Block Rule
  const handleAddHoldRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!holdReason) return;

    const newRule: HoldRule = {
      id: `HR-${Date.now().toString().slice(-4)}`,
      venueId: currentVenue.id,
      zoneName: holdZoneName || currentVenue.zones[0]?.name,
      seatsCount: holdSeatsCount,
      type: holdType,
      reason: holdReason,
      createdAt: new Date().toLocaleDateString('vi-VN'),
    };

    setHoldRules([newRule, ...holdRules]);
    setHoldReason('');
    triggerToast(
      holdType === 'BLOCK'
        ? `Đã khóa chặn ${holdSeatsCount} ghế kỹ thuật thành công!`
        : `Đã giữ chỗ ${holdSeatsCount} ghế VIP/Vé mời thành công!`,
    );
  };

  const venueHoldRules = holdRules.filter((r) => r.venueId === currentVenue.id);
  const totalHeldSeats = venueHoldRules.reduce((sum, r) => sum + r.seatsCount, 0);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 99999,
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 20px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: 'var(--success)',
            fontWeight: 600,
            fontSize: '13.5px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

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
              fontSize: '30px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: '2px 0 0',
            }}
          >
            Địa điểm tổ chức & Sơ đồ ghế
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '13.5px', color: 'var(--muted)' }}>
            Quản lý cơ sở vật chất, thiết kế phân khu sơ đồ khán phòng và điều phối ghế khóa/giữ chỗ.
          </p>
        </div>

        <button onClick={() => setShowAddVenueModal(true)} className="btn btn-primary">
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
          const isSelected = v.id === selectedVenueId;
          return (
            <div
              key={v.id}
              onClick={() => {
                setSelectedVenueId(v.id);
                setHoldZoneName(v.zones[0]?.name || '');
              }}
              className="card"
              style={{
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                backgroundColor: 'var(--surface)',
                boxShadow: isSelected ? '0 0 0 2px var(--primary-tint), var(--shadow-md)' : 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '18px',
                    fontWeight: 700,
                    margin: 0,
                    color: isSelected ? 'var(--primary)' : 'var(--text)',
                  }}
                >
                  {v.name}
                </h3>
                <span
                  className={`badge ${
                    v.status === 'Đã xác minh'
                      ? 'badge-success'
                      : v.status === 'Chờ duyệt'
                      ? 'badge-warning'
                      : 'badge-tint'
                  }`}
                >
                  {v.status}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--muted)', margin: '0 0 16px' }}>
                <MapPin size={14} color="var(--primary)" />
                <span>{v.address}</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={15} color="var(--muted)" />
                  <span>Sức chứa: <strong>{v.capacity}</strong> chỗ</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Grid3X3 size={15} color="var(--muted)" />
                  <span><strong>{v.zones.length}</strong> phân khu</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Seat Map Visualizer Card */}
      <div className="card" style={{ padding: '28px', marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '12px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '18px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '20px',
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                Sơ đồ bố trí: {currentVenue.name}
              </h3>
              {totalHeldSeats > 0 && (
                <span className="badge badge-warning" style={{ fontSize: '11.5px' }}>
                  <Lock size={12} /> Đang giữ chỗ: {totalHeldSeats} ghế
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
              Mô hình trực quan các phân khu khán giả và sân khấu biểu diễn trung tâm.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={() => setShowEditLayoutModal(true)}
              className="btn btn-outline"
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              <Sliders size={15} />
              <span>Chỉnh sửa sơ đồ</span>
            </button>
            <button
              onClick={() => setShowHoldModal(true)}
              className="btn btn-outline"
              style={{ fontSize: '13px', padding: '8px 16px' }}
            >
              <Lock size={15} />
              <span>Giữ chỗ / Chặn ghế</span>
            </button>
          </div>
        </div>

        {/* Stage & Grid representation */}
        <div
          style={{
            backgroundColor: 'var(--bg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '40px 20px',
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
              backgroundColor: 'var(--navy, #172A35)',
              color: '#FFFFFF',
              textAlign: 'center',
              padding: '14px',
              borderRadius: '8px',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.08em',
              marginBottom: '36px',
              boxShadow: '0 4px 12px rgba(23, 42, 53, 0.15)',
              border: '1px solid rgba(255,255,255,0.1)',
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
              maxWidth: '600px',
            }}
          >
            {currentVenue.zones.map((zone) => {
              // calculate held seats in this zone
              const zoneHeldCount = venueHoldRules
                .filter((r) => r.zoneName === zone.name)
                .reduce((s, r) => s + r.seatsCount, 0);

              return (
                <div
                  key={zone.id || zone.name}
                  style={{
                    border: `2px solid ${zone.color}`,
                    borderRadius: '10px',
                    backgroundColor: 'var(--surface)',
                    padding: '16px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    transition: 'transform 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: zone.color,
                        boxShadow: `0 0 0 3px ${zone.color}22`,
                      }}
                    />
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <strong style={{ fontSize: '14.5px', color: 'var(--text)' }}>
                          {zone.name}
                        </strong>
                        {zoneHeldCount > 0 && (
                          <span
                            className="badge badge-warning"
                            style={{ fontSize: '10.5px', padding: '2px 6px' }}
                            title="Số ghế đang bị khóa/giữ chỗ"
                          >
                            Khóa {zoneHeldCount} ghế
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        Tổng {zone.seats} chỗ ngồi {zoneHeldCount > 0 && `(Khả dụng: ${zone.seats - zoneHeldCount} ghế)`}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: zone.color }}>
                      {zone.price}
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Giá tham khảo</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* MODAL 1: THÊM ĐỊA ĐIỂM MỚI */}
      {showAddVenueModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.6)',
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
              maxWidth: '560px',
              backgroundColor: 'var(--surface)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              padding: '28px',
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
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  Cơ sở vật chất
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700, margin: '2px 0 0' }}>
                  Thêm địa điểm tổ chức mới
                </h2>
              </div>
              <button onClick={() => setShowAddVenueModal(false)} className="btn-ghost" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--muted)" />
              </button>
            </div>

            <form onSubmit={handleAddVenue} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label>
                Tên địa điểm / Khán phòng *
                <input
                  type="text"
                  placeholder="VD: Trung tâm Hội nghị GEM Center"
                  value={newVenueName}
                  onChange={(e) => setNewVenueName(e.target.value)}
                  required
                />
              </label>

              <label>
                Địa chỉ chi tiết *
                <input
                  type="text"
                  placeholder="VD: Số 8 Nguyễn Bỉnh Khiêm, Đa Kao, Quận 1, TP.HCM"
                  value={newVenueAddress}
                  onChange={(e) => setNewVenueAddress(e.target.value)}
                  required
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <label>
                  Loại hình địa điểm
                  <select value={newVenueType} onChange={(e) => setNewVenueType(e.target.value)}>
                    <option value="Khán phòng sự kiện">Khán phòng sự kiện</option>
                    <option value="Nhà hát kịch nghệ & hòa nhạc">Nhà hát kịch & hòa nhạc</option>
                    <option value="Sân khấu ngoài trời">Sân khấu ngoài trời</option>
                    <option value="Sân vận động / Nhà thi đấu">Sân vận động / Nhà thi đấu</option>
                    <option value="Hội trường / Khách sạn">Hội trường / Khách sạn</option>
                  </select>
                </label>

                <label>
                  Sức chứa thiết kế (Chỗ)
                  <input
                    type="number"
                    min="50"
                    step="10"
                    value={newVenueCapacity}
                    onChange={(e) => setNewVenueCapacity(Number(e.target.value))}
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
                <button type="button" onClick={() => setShowAddVenueModal(false)} className="btn btn-outline">
                  Hủy bỏ
                </button>
                <button type="submit" className="btn btn-primary">
                  Lưu địa điểm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CHỈNH SỬA SƠ ĐỒ (EDIT LAYOUT & ZONES) */}
      {showEditLayoutModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.6)',
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
              padding: '28px',
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
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  Thiết kế khán phòng
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700, margin: '2px 0 0' }}>
                  Chỉnh sửa phân khu: {currentVenue.name}
                </h2>
              </div>
              <button onClick={() => setShowEditLayoutModal(false)} className="btn-ghost" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--muted)" />
              </button>
            </div>

            {/* List of current zones */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
                Danh sách phân khu ({currentVenue.zones.length}) · Tổng sức chứa: <strong>{currentVenue.capacity}</strong> ghế
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {currentVenue.zones.map((zone) => (
                  <div
                    key={zone.id || zone.name}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      backgroundColor: 'var(--surface-alt)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
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
                        <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{zone.name}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {zone.seats} ghế · Giá tham khảo: <strong>{zone.price}</strong>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setDeleteConfirm({
                          title: 'Xóa phân khu này?',
                          message: `Bạn có chắc muốn xóa phân khu "${zone.name}" (${zone.seats} ghế) khỏi sơ đồ địa điểm?`,
                          onConfirm: () => {
                            const updatedZones = currentVenue.zones.filter((z) => (z.id || z.name) !== (zone.id || zone.name));
                            const updatedCapacity = updatedZones.reduce((sum, z) => sum + z.seats, 0);
                            setVenues(
                              venues.map((v) =>
                                v.id === currentVenue.id ? { ...v, zones: updatedZones, capacity: updatedCapacity } : v,
                              ),
                            );
                            setDeleteConfirm(null);
                            triggerToast(`Đã xóa phân khu "${zone.name}"!`);
                          },
                        });
                      }}
                      className="btn-ghost"
                      style={{ color: 'var(--danger)', padding: '6px', border: 'none', background: 'none', cursor: 'pointer' }}
                      title="Xóa phân khu"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Form Add New Zone */}
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
                Thêm phân khu khán đài mới
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                <label style={{ fontSize: '12px' }}>
                  Tên phân khu
                  <input
                    type="text"
                    placeholder="VD: Khu Khán Đài C"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </label>

                <label style={{ fontSize: '12px' }}>
                  Số ghế
                  <input
                    type="number"
                    min="10"
                    value={newZoneSeats}
                    onChange={(e) => setNewZoneSeats(Number(e.target.value))}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </label>

                <label style={{ fontSize: '12px' }}>
                  Giá tham khảo
                  <input
                    type="text"
                    placeholder="VD: 400.000đ"
                    value={newZonePrice}
                    onChange={(e) => setNewZonePrice(e.target.value)}
                    style={{ height: '36px', fontSize: '13px' }}
                  />
                </label>

                <button
                  type="button"
                  onClick={handleAddZone}
                  className="btn btn-outline"
                  style={{ height: '36px', fontSize: '13px', padding: '0 14px' }}
                >
                  Thêm
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Màu đại diện:</span>
                {['#D9422D', '#315D99', '#1B7956', '#946018', '#7C3AED', '#DB2777'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewZoneColor(c)}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: c,
                      border: newZoneColor === c ? '2px solid #000' : 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowEditLayoutModal(false);
                  triggerToast('Đã lưu cấu trúc sơ đồ khán phòng!');
                }}
                className="btn btn-primary"
              >
                Hoàn tất & Lưu sơ đồ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: GIỮ CHỖ / CHẶN GHẾ (HOLD / BLOCK SEATS) */}
      {showHoldModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.6)',
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
              maxWidth: '720px',
              backgroundColor: 'var(--surface)',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              padding: '28px',
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
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase' }}>
                  Kiểm soát ghế ngồi
                </div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '21px', fontWeight: 700, margin: '2px 0 0' }}>
                  Khóa ghế kỹ thuật & Giữ chỗ VIP · {currentVenue.name}
                </h2>
              </div>
              <button onClick={() => setShowHoldModal(false)} className="btn-ghost" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--muted)" />
              </button>
            </div>

            {/* Active Hold Rules Table */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text)', marginBottom: '12px' }}>
                Các lệnh đang khóa / giữ chỗ ({venueHoldRules.length})
              </div>

              {venueHoldRules.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-md)', color: 'var(--muted)', fontSize: '13px' }}>
                  Chưa có ghế nào bị khóa hoặc giữ chỗ tại địa điểm này. Toàn bộ ghế đang mở bán bình thường.
                </div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table className="table" style={{ margin: 0, width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Phân khu</th>
                        <th>Loại khóa</th>
                        <th>Số ghế</th>
                        <th>Lý do</th>
                        <th style={{ textAlign: 'right' }}>Tháo khóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {venueHoldRules.map((rule) => (
                        <tr key={rule.id}>
                          <td><strong>{rule.zoneName}</strong></td>
                          <td>
                            {rule.type === 'BLOCK' ? (
                              <span className="badge badge-danger">
                                <ShieldAlert size={12} /> Khóa kỹ thuật
                              </span>
                            ) : (
                              <span className="badge badge-warning">
                                <Lock size={12} /> Giữ chỗ VIP / COMP
                              </span>
                            )}
                          </td>
                          <td><strong>{rule.seatsCount}</strong> ghế</td>
                          <td style={{ fontSize: '12.5px', color: 'var(--muted)' }}>{rule.reason}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => {
                                setDeleteConfirm({
                                  title: 'Hủy lệnh khóa ghế này?',
                                  message: `Mở khóa ${rule.seatsCount} ghế tại "${rule.zoneName}" để đưa ghế trở lại mở bán bình thường?`,
                                  onConfirm: () => {
                                    setHoldRules(holdRules.filter((r) => r.id !== rule.id));
                                    setDeleteConfirm(null);
                                    triggerToast(`Đã mở khóa ${rule.seatsCount} ghế thành công!`);
                                  },
                                });
                              }}
                              className="btn btn-outline"
                              style={{ fontSize: '11.5px', padding: '4px 10px', color: 'var(--primary)' }}
                            >
                              Mở khóa
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Form Create New Hold Rule */}
            <form onSubmit={handleAddHoldRule} style={{ border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '18px', backgroundColor: 'var(--bg)' }}>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={16} color="var(--primary)" />
                Thiết lập lệnh giữ chỗ / khóa ghế mới
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                <label>
                  Chọn phân khu
                  <select value={holdZoneName} onChange={(e) => setHoldZoneName(e.target.value)}>
                    {currentVenue.zones.map((z) => (
                      <option key={z.id || z.name} value={z.name}>
                        {z.name} ({z.seats} ghế)
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Mục đích khóa
                  <select value={holdType} onChange={(e) => setHoldType(e.target.value as 'BLOCK' | 'HOLD_COMP')}>
                    <option value="HOLD_COMP">Giữ chỗ VIP / Vé mời Ban tổ chức (COMP)</option>
                    <option value="BLOCK">Khóa kỹ thuật (Camera / Âm thanh / An toàn)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '14px', marginBottom: '14px' }}>
                <label>
                  Số ghế khóa
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={holdSeatsCount}
                    onChange={(e) => setHoldSeatsCount(Number(e.target.value))}
                    required
                  />
                </label>

                <label>
                  Ghi chú / Lý do khóa
                  <input
                    type="text"
                    placeholder="VD: Dành cho Ban giám khảo & Nhà tài trợ"
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
                  Áp dụng khóa ghế
                </button>
              </div>
            </form>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowHoldModal(false)} className="btn btn-outline">
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REUSABLE DELETE CONFIRMATION MODAL */}
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
            zIndex: 99999,
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
