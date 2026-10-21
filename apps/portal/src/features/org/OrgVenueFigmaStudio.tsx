import { useState } from 'react';
import {
  CheckCircle2,
  Grid3X3,
  History,
  FileText,
  Layers,
  ShieldCheck,
  Upload,
  Plus,
  Trash2,
} from 'lucide-react';
import { DocumentPreviewModal, type DocumentPreviewItem } from '../../components/common/DocumentPreviewModal';

type VenueStudioTab =
  | 'o-layout-editor'
  | 'o-layout-type'
  | 'o-layout-standing'
  | 'o-layout-stadium'
  | 'o-layout-cinema'
  | 'o-layout-publish'
  | 'o-layout-published'
  | 'o-layout-history'
  | 'o-venue-edit'
  | 'o-venue-pending';

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const COLS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

interface LayoutVersionEntry {
  version: string;
  timestamp: string;
  summary: string;
  author: string;
  status: 'Đang dùng' | 'Lưu trữ';
}

export function OrgVenueFigmaStudio() {
  const [studioTab, setStudioTab] = useState<VenueStudioTab>('o-layout-editor');
  const [selectedSeat, setSelectedSeat] = useState('A01');
  const [seatStates, setSeatStates] = useState<Record<string, 'OPEN' | 'HOLD' | 'BLOCK'>>({
    A04: 'HOLD',
    A05: 'HOLD',
    B01: 'BLOCK',
    B02: 'BLOCK',
  });
  const [seatZoneMap, setSeatZoneMap] = useState<Record<string, string>>({});
  const [selectedLayoutType, setSelectedLayoutType] = useState<'THEATER' | 'STADIUM' | 'CINEMA' | 'STANDING'>('THEATER');

  // Standing layout interactive state (o-layout-standing)
  const [standingZoneName, setStandingZoneName] = useState('Khu đứng chính (General Admission)');
  const [standingCapacity, setStandingCapacity] = useState(300);
  const [standingGate, setStandingGate] = useState('Cổng G2');

  // Stadium interactive zones (o-layout-stadium)
  const [stadiumZones, setStadiumZones] = useState([
    { id: 'st-1', name: 'Khán đài Bắc (A1–A4)', capacity: 1200, gate: 'Cổng G1' },
    { id: 'st-2', name: 'Sân cỏ Fanzone / Standing VIP', capacity: 800, gate: 'Cổng VIP' },
    { id: 'st-3', name: 'Khán đài Nam (B1–B4)', capacity: 1200, gate: 'Cổng G2' },
  ]);
  const [newStadiumZoneName, setNewStadiumZoneName] = useState('');
  const [newStadiumZoneCap, setNewStadiumZoneCap] = useState(400);

  // Cinema interactive rows (o-layout-cinema)
  const [cinemaZones, setCinemaZones] = useState([
    { id: 'ci-1', name: 'Hàng A–C · Ghế Tiêu chuẩn', seats: 30, price: '120.000đ' },
    { id: 'ci-2', name: 'Hàng D–G · Ghế VIP Trung tâm', seats: 40, price: '180.000đ' },
    { id: 'ci-3', name: 'Hàng H · Ghế đôi Sweetbox', seats: 20, price: '320.000đ' },
  ]);

  // Layout version history state (o-layout-history / o-layout-publish)
  const [versionHistory, setVersionHistory] = useState<LayoutVersionEntry[]>([
    {
      version: 'v4',
      timestamp: '07/10 11:15',
      summary: 'Gán cổng mặc định G1 & G2 cho 80 ghế A01–H10',
      author: 'Owner · Ánh Trăng Events',
      status: 'Đang dùng',
    },
    {
      version: 'v3',
      timestamp: '05/10 16:40',
      summary: 'Bổ sung khu VIP hàng A–C',
      author: 'Owner · Ánh Trăng Events',
      status: 'Lưu trữ',
    },
  ]);
  const [publishNote, setPublishNote] = useState('Cập nhật phân khu ghế và kiểm tra lối thoát hiểm');

  // Venue verification interactive state (o-venue-edit / o-venue-pending)
  const [venueEditName, setVenueEditName] = useState('Sân khấu Bến Sông');
  const [venueEditType, setVenueEditType] = useState('Sân khấu ngoài trời / Khu đứng');
  const [venueEditAddress, setVenueEditAddress] = useState('Bến Bạch Đằng, Quận 1, TP. Hồ Chí Minh');
  const [venueDocs, setVenueDocs] = useState<string[]>([
    'hop-dong-thue-dia-diem-ben-song.pdf',
    'phuong-an-pccc-ben-song-2026.pdf',
  ]);
  const [venueVerifyStatus, setVenueVerifyStatus] = useState<'DRAFT' | 'PENDING' | 'APPROVED'>('PENDING');

  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);

  const currentSeatState = seatStates[selectedSeat] || 'OPEN';
  const currentSeatRow = selectedSeat.slice(0, 1);
  const defaultZone = ['A', 'B', 'C'].includes(currentSeatRow) ? 'Khu VIP (Hàng A–C)' : 'Khu Standard (Hàng D–H)';
  const currentSeatZone = seatZoneMap[selectedSeat] || defaultZone;

  const totalSeats = ROWS.length * COLS.length;
  const holdCount = Object.values(seatStates).filter((s) => s === 'HOLD').length;
  const blockCount = Object.values(seatStates).filter((s) => s === 'BLOCK').length;
  const openCount = totalSeats - holdCount - blockCount;

  const activeVersion = versionHistory.find((v) => v.status === 'Đang dùng')?.version || 'v4';

  const applyRowState = (row: string, st: 'OPEN' | 'HOLD' | 'BLOCK') => {
    setSeatStates((prev) => {
      const next = { ...prev };
      COLS.forEach((c) => {
        next[`${row}${c}`] = st;
      });
      return next;
    });
  };

  const handlePublishNewVersion = () => {
    const nextNum = versionHistory.length + 3;
    const nextVer = `v${nextNum}`;
    const now = new Date();
    const ts = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setVersionHistory((prev) => [
      {
        version: nextVer,
        timestamp: ts,
        summary: publishNote || `Phát hành sơ đồ (${openCount} mở, ${holdCount} giữ, ${blockCount} chặn)`,
        author: 'Owner · Ánh Trăng Events',
        status: 'Đang dùng',
      },
      ...prev.map((item) => ({ ...item, status: 'Lưu trữ' as const })),
    ]);
    setStudioTab('o-layout-history');
  };

  return (
    <div className="card" style={{ padding: '24px', marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <span className="tag-overline">
            03 / ORGANIZATION · STUDIO SƠ ĐỒ CHỖ NGỒI & HỒ SƠ ĐỊA ĐIỂM FIGMA (Đang dùng: {activeVersion})
          </span>
          <h2 style={{ fontSize: '22px', margin: '4px 0' }}>
            Trình thiết kế sơ đồ ghế 8×10, 4 loại hình địa điểm & Kiểm tra phát hành
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
            Thao tác trực tiếp trên từng ghế A01–H10, thêm/xóa khu vực khán đài, phát hành phiên bản mới vào lịch sử sơ đồ và tải lên giấy phép địa điểm.
          </p>
        </div>
      </div>

      {/* Sub-navigation pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        {(
          [
            { id: 'o-layout-editor', label: `Sơ đồ ghế A01–H10 (${openCount} mở)` },
            { id: 'o-layout-type', label: 'Chọn 4 loại hình (o-layout-type)' },
            { id: 'o-layout-standing', label: `Khu đứng (${standingCapacity} chỗ)` },
            { id: 'o-layout-stadium', label: `Sân vận động (${stadiumZones.length} khu)` },
            { id: 'o-layout-cinema', label: `Rạp phim (${cinemaZones.length} khu)` },
            { id: 'o-layout-publish', label: 'Kiểm tra & Phát hành (o-layout-publish)' },
            { id: 'o-layout-published', label: `Bản chỉ xem (${activeVersion})` },
            { id: 'o-layout-history', label: `Lịch sử (${versionHistory.length} bản)` },
            { id: 'o-venue-edit', label: 'Hồ sơ xác minh địa điểm (o-venue-edit)' },
            { id: 'o-venue-pending', label: `Trạng thái xác minh (${venueVerifyStatus})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStudioTab(tab.id)}
            className={`btn ${studioTab === tab.id ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '7px 12px', fontSize: '12px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1:6299 | o-layout-editor / Chỉnh sửa sơ đồ ghế 8x10 A01-H10 */}
      {studioTab === 'o-layout-editor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span className="tag-overline" style={{ marginBottom: '2px' }}>1:6299 · o-layout-editor</span>
                <h3 style={{ margin: 0, fontSize: '18px' }}>Sơ đồ ghế Nhà hát Ánh Trăng ({activeVersion})</h3>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Đang mở: <strong>{openCount}</strong> • Giữ nội bộ: <strong>{holdCount}</strong> • Chặn bán: <strong>{blockCount}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
                <button
                  type="button"
                  onClick={() => setSeatStates({})}
                  className="btn btn-outline"
                  style={{ padding: '5px 10px', fontSize: '11px' }}
                >
                  Mở lại toàn bộ 80 ghế
                </button>
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--navy)',
                color: '#FFFFFF',
                textAlign: 'center',
                padding: '10px',
                borderRadius: 'var(--radius-md)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                marginBottom: '18px',
              }}
            >
              SÂN KHẤU CHÍNH / HƯỚNG NHÌN KHÁN PHÒNG
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ROWS.map((r) => (
                <div key={r} style={{ display: 'grid', gridTemplateColumns: '28px repeat(10, 1fr)', gap: '6px', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textAlign: 'center' }}>{r}</div>
                  {COLS.map((c) => {
                    const code = `${r}${c}`;
                    const st = seatStates[code] || 'OPEN';
                    const isSel = selectedSeat === code;
                    const isVip = ['A', 'B', 'C'].includes(r);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setSelectedSeat(code)}
                        style={{
                          padding: '7px 2px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          border: isSel ? '2px solid var(--navy)' : '1px solid var(--border)',
                          backgroundColor:
                            st === 'BLOCK'
                              ? 'var(--danger-bg)'
                              : st === 'HOLD'
                              ? 'var(--warning-bg)'
                              : isVip
                              ? 'var(--primary-tint)'
                              : '#FFFFFF',
                          color:
                            st === 'BLOCK'
                              ? 'var(--danger)'
                              : st === 'HOLD'
                              ? 'var(--warning)'
                              : isVip
                              ? 'var(--primary)'
                              : 'var(--text)',
                        }}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <span className="badge badge-tint" style={{ marginBottom: '8px' }}>Thuộc tính ghế đang chọn</span>
                <h3 style={{ margin: 0, fontSize: '20px' }}>Ghế {selectedSeat} (Hàng {currentSeatRow})</h3>
              </div>

              <label>
                Khu / dãy của ghế {selectedSeat}
                <input
                  type="text"
                  value={currentSeatZone}
                  onChange={(e) => setSeatZoneMap((prev) => ({ ...prev, [selectedSeat]: e.target.value }))}
                />
              </label>

              <label>
                Trạng thái ghế {selectedSeat}
                <select
                  value={currentSeatState}
                  onChange={(e) =>
                    setSeatStates((prev) => ({
                      ...prev,
                      [selectedSeat]: e.target.value as 'OPEN' | 'HOLD' | 'BLOCK',
                    }))
                  }
                >
                  <option value="OPEN">Đang mở (Mở bán bình thường)</option>
                  <option value="HOLD">Giữ nội bộ (Khách mời / VIP Hold)</option>
                  <option value="BLOCK">Chặn bán (Kỹ thuật / Khuất tầm nhìn)</option>
                </select>
              </label>

              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                  Thao tác nhanh cả Hàng {currentSeatRow} (10 ghế):
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => applyRowState(currentSeatRow, 'OPEN')} className="btn btn-outline" style={{ flex: 1, padding: '6px', fontSize: '11px' }}>
                    Mở hàng {currentSeatRow}
                  </button>
                  <button type="button" onClick={() => applyRowState(currentSeatRow, 'HOLD')} className="btn btn-outline" style={{ flex: 1, padding: '6px', fontSize: '11px' }}>
                    Giữ hàng {currentSeatRow}
                  </button>
                  <button type="button" onClick={() => applyRowState(currentSeatRow, 'BLOCK')} className="btn btn-outline" style={{ flex: 1, padding: '6px', fontSize: '11px', color: 'var(--danger)' }}>
                    Chặn hàng {currentSeatRow}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setStudioTab('o-layout-publish')}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Kiểm tra & Phát hành sơ đồ →
              </button>
              <button
                type="button"
                onClick={() => setStudioTab('o-layout-type')}
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Đổi loại sơ đồ (o-layout-change)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 73:6879 | o-layout-type & 156:9969 | o-layout-change */}
      {studioTab === 'o-layout-type' && (
        <div>
          <span className="tag-overline">73:6879 · o-layout-type & 156:9969 · o-layout-change</span>
          <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>Chọn loại hình địa điểm (Đang chọn: {selectedLayoutType})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
            {[
              { id: 'THEATER', title: 'Nhà hát / Khán phòng', desc: 'Ghế đánh số theo hàng A01–H10, phân tách VIP & Standard', target: 'o-layout-editor' as const },
              { id: 'STADIUM', title: 'Sân vận động', desc: 'Khán đài Bắc/Nam/Đông/Tây kết hợp khu Fanzone sân cỏ', target: 'o-layout-stadium' as const },
              { id: 'CINEMA', title: 'Rạp chiếu phim', desc: 'Màn hình cong, ghế tiêu chuẩn, ghế VIP trung tâm & Sweetbox', target: 'o-layout-cinema' as const },
              { id: 'STANDING', title: 'Khu đứng (GA)', desc: 'Quản lý theo tổng sức chứa khu vực và gán cổng soát vé', target: 'o-layout-standing' as const },
            ].map((item) => (
              <div
                key={item.id}
                style={{
                  padding: '18px',
                  borderRadius: 'var(--radius-lg)',
                  border: selectedLayoutType === item.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                  backgroundColor: selectedLayoutType === item.id ? 'var(--primary-tint)' : 'var(--bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: '16px' }}>{item.title}</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>{item.desc}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLayoutType(item.id as typeof selectedLayoutType);
                    setStudioTab(item.target);
                  }}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '8px 12px', fontSize: '12px' }}
                >
                  Thiết kế {item.title}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 1:6652 | o-layout-standing / Sơ đồ khu đứng */}
      {studioTab === 'o-layout-standing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <span className="tag-overline">1:6652 · o-layout-standing / Sơ đồ khu đứng</span>
            <h3 style={{ fontSize: '20px', marginBottom: '16px' }}>Cấu hình Khu đứng (Sân khấu Bến Sông)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label>
                Tên khu đứng
                <input type="text" value={standingZoneName} onChange={(e) => setStandingZoneName(e.target.value)} />
              </label>
              <label>
                Sức chứa tối đa (Số người)
                <input type="number" value={standingCapacity} onChange={(e) => setStandingCapacity(Number(e.target.value) || 0)} />
              </label>
              <label>
                Cổng đề xuất
                <select value={standingGate} onChange={(e) => setStandingGate(e.target.value)}>
                  <option value="Cổng G1">Cổng G1</option>
                  <option value="Cổng G2">Cổng G2</option>
                  <option value="Tất cả các cổng">Tất cả các cổng</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setStudioTab('o-layout-publish')}
                className="btn btn-primary"
              >
                Lưu & Kiểm tra trước khi phát hành
              </button>
            </div>
          </div>

          <div style={{ padding: '24px', backgroundColor: 'var(--navy)', color: '#FFFFFF', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <Layers size={36} />
            <h3 style={{ color: '#FFFFFF', margin: '12px 0 4px' }}>{standingZoneName}</h3>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '14px' }}>
              Sức chứa: <strong>{standingCapacity} vé</strong> • Cổng soát vé: <strong>{standingGate}</strong>
            </p>
          </div>
        </div>
      )}

      {/* 74:7084 | o-layout-stadium / Sơ đồ sân vận động */}
      {studioTab === 'o-layout-stadium' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">74:7084 · o-layout-stadium / Sơ đồ sân vận động</span>
          <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>
            Bố cục Sân vận động (Tổng sức chứa: {stadiumZones.reduce((s, z) => s + z.capacity, 0)} chỗ)
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            {stadiumZones.map((z) => (
              <div key={z.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{z.name}</strong>
                  <p className="text-muted" style={{ fontSize: '12px', margin: '4px 0 0' }}>
                    {z.capacity} chỗ · {z.gate}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStadiumZones((prev) => prev.filter((item) => item.id !== z.id))}
                  className="btn btn-ghost"
                  style={{ padding: '4px', color: 'var(--danger)' }}
                  title="Xóa kháng đài"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginBottom: '18px' }}>
            <label style={{ flex: 2 }}>
              Thêm khán đài / khu vực mới
              <input
                type="text"
                placeholder="VD: Khán đài Đông (C1–C3)"
                value={newStadiumZoneName}
                onChange={(e) => setNewStadiumZoneName(e.target.value)}
              />
            </label>
            <label style={{ flex: 1 }}>
              Sức chứa
              <input
                type="number"
                value={newStadiumZoneCap}
                onChange={(e) => setNewStadiumZoneCap(Number(e.target.value) || 100)}
              />
            </label>
            <button
              type="button"
              onClick={() => {
                if (!newStadiumZoneName.trim()) return;
                setStadiumZones((prev) => [
                  ...prev,
                  { id: `st-${Date.now()}`, name: newStadiumZoneName.trim(), capacity: newStadiumZoneCap, gate: 'Cổng G2' },
                ]);
                setNewStadiumZoneName('');
              }}
              className="btn btn-outline"
              style={{ height: '42px' }}
            >
              <Plus size={15} /> Thêm khu vực
            </button>
          </div>

          <button type="button" onClick={() => setStudioTab('o-layout-publish')} className="btn btn-primary">
            Lưu và kiểm tra sơ đồ sân vận động
          </button>
        </div>
      )}

      {/* 74:7493 | o-layout-cinema / Sơ đồ rạp chiếu phim */}
      {studioTab === 'o-layout-cinema' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">74:7493 · o-layout-cinema / Sơ đồ rạp chiếu phim</span>
          <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>
            Bố cục Rạp chiếu phim ({cinemaZones.reduce((s, z) => s + z.seats, 0)} ghế)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            {cinemaZones.map((cz, idx) => (
              <div key={cz.id} className="card">
                <strong>{cz.name}</strong>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <label style={{ flex: 1, fontSize: '11px' }}>
                    Số ghế
                    <input
                      type="number"
                      value={cz.seats}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        setCinemaZones((prev) => prev.map((item, i) => (i === idx ? { ...item, seats: val } : item)));
                      }}
                    />
                  </label>
                  <label style={{ flex: 1, fontSize: '11px' }}>
                    Giá vé
                    <input
                      type="text"
                      value={cz.price}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCinemaZones((prev) => prev.map((item, i) => (i === idx ? { ...item, price: val } : item)));
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setStudioTab('o-layout-publish')} className="btn btn-primary">
            Lưu và kiểm tra sơ đồ rạp chiếu phim
          </button>
        </div>
      )}

      {/* 1:6799 | o-layout-publish / Kiểm tra sơ đồ trước khi phát hành */}
      {studioTab === 'o-layout-publish' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span className="tag-overline">1:6799 · o-layout-publish / Kiểm tra sơ đồ trước khi phát hành</span>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Kiểm tra 4 loại sơ đồ · Nhà hát Ánh Trăng</h3>
            </div>
            <span className="badge badge-success">
              <ShieldCheck size={14} /> Đủ điều kiện phát hành
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
            {[
              { label: 'Không trùng nhãn ghế', value: `Đã kiểm tra ${totalSeats}/${totalSeats} ghế (${openCount} mở, ${holdCount} giữ, ${blockCount} chặn)` },
              { label: 'Khu đứng có sức chứa > 0', value: `Hợp lệ (${standingCapacity} chỗ)` },
              { label: 'Lối thoát hiểm & Khoảng cách hàng', value: 'Đạt chuẩn an toàn khán phòng' },
              { label: 'Cổng soát vé mặc định', value: `Đã gán Cổng G1 & ${standingGate}` },
            ].map((item, i) => (
              <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{item.label}</div>
                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{item.value}</div>
                </div>
                <CheckCircle2 size={18} color="var(--success)" />
              </div>
            ))}
          </div>

          <label style={{ marginBottom: '16px' }}>
            Ghi chú phát hành phiên bản mới
            <input
              type="text"
              value={publishNote}
              onChange={(e) => setPublishNote(e.target.value)}
              placeholder="Nhập tóm tắt thay đổi của phiên bản sơ đồ..."
            />
          </label>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={handlePublishNewVersion}
              className="btn btn-primary"
            >
              Phát hành phiên bản mới (v{versionHistory.length + 3})
            </button>
            <button type="button" onClick={() => setStudioTab('o-layout-editor')} className="btn btn-outline">
              Quay lại chỉnh sửa
            </button>
          </div>
        </div>
      )}

      {/* 117:7462 | o-layout-published / Sơ đồ đã phát hành · Chỉ xem */}
      {studioTab === 'o-layout-published' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div>
              <span className="tag-overline">117:7462 · o-layout-published / Sơ đồ đã phát hành · Chỉ xem</span>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Nhà hát Ánh Trăng · Layout {activeVersion} (Read-Only Snapshot)</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                Đang áp dụng: {openCount} ghế mở bán • {holdCount} ghế giữ nội bộ • {blockCount} ghế chặn kỹ thuật.
              </p>
            </div>
            <span className="badge badge-info">Đã khóa phiên bản {activeVersion}</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button type="button" onClick={() => setStudioTab('o-layout-history')} className="btn btn-outline">
              <History size={15} /> Xem lịch sử phiên bản ({versionHistory.length} bản)
            </button>
            <button
              type="button"
              onClick={() => setStudioTab('o-layout-editor')}
              className="btn btn-primary"
            >
              <Grid3X3 size={15} /> Mở trình chỉnh sửa để tạo bản nháp mới
            </button>
          </div>
        </div>
      )}

      {/* 1:6938 | o-layout-history / Lịch sử sơ đồ */}
      {studioTab === 'o-layout-history' && (
        <div>
          <span className="tag-overline">1:6938 · o-layout-history / Lịch sử sơ đồ</span>
          <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>Lịch sử phiên bản sơ đồ chỗ ngồi</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Phiên bản</th>
                <th>Thay đổi chính</th>
                <th>Người phát hành</th>
                <th>Trạng thái</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {versionHistory.map((item) => (
                <tr key={item.version}>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                    {item.version} / {item.timestamp}
                  </td>
                  <td>{item.summary}</td>
                  <td>{item.author}</td>
                  <td>
                    {item.status === 'Đang dùng' ? (
                      <span className="badge badge-success">Đang dùng</span>
                    ) : (
                      <span className="badge badge-info">Lưu trữ</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {item.status === 'Đang dùng' ? (
                      <button
                        type="button"
                        onClick={() => setStudioTab('o-layout-published')}
                        className="btn btn-outline"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Mở bản chỉ xem
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setVersionHistory((prev) =>
                            prev.map((v) => ({
                              ...v,
                              status: v.version === item.version ? 'Đang dùng' : 'Lưu trữ',
                            })),
                          )
                        }
                        className="btn btn-outline"
                        style={{ padding: '6px 12px', fontSize: '12px' }}
                      >
                        Kích hoạt lại {item.version}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 1:6005 | o-venue-edit & 139:9186 | o-venue-bensong */}
      {studioTab === 'o-venue-edit' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <span className="tag-overline">1:6005 · o-venue-edit & 139:9186 · o-venue-bensong</span>
            <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>Thông tin địa điểm và xác minh giấy phép</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <label>
                Tên địa điểm
                <input type="text" value={venueEditName} onChange={(e) => setVenueEditName(e.target.value)} />
              </label>
              <label>
                Loại địa điểm
                <input type="text" value={venueEditType} onChange={(e) => setVenueEditType(e.target.value)} />
              </label>
              <label style={{ gridColumn: 'span 2' }}>
                Địa chỉ
                <input type="text" value={venueEditAddress} onChange={(e) => setVenueEditAddress(e.target.value)} />
              </label>
            </div>
            <div style={{ padding: '14px', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-strong)', backgroundColor: 'var(--surface)', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>
                    <Upload size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Giấy tờ xác minh địa điểm ({venueDocs.length} tệp đính kèm)
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--success)', marginTop: '2px' }}>
                    {venueDocs.map((d) => `✓ ${d}`).join(' • ')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewDoc({
                      title: `Hồ sơ địa điểm và giấy phép · ${venueEditName}`,
                      issuer: 'Ánh Trăng Events',
                      code: 'VV-01',
                      fileName: venueDocs[0] || 'hop-dong-thue-dia-diem.pdf',
                    })
                  }
                  className="btn btn-outline"
                  style={{ padding: '6px 12px', fontSize: '12px' }}
                >
                  <FileText size={14} /> Xem tài liệu
                </button>
              </div>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setVenueDocs((prev) => [...prev, file.name]);
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setVenueVerifyStatus('PENDING');
                setStudioTab('o-venue-pending');
              }}
              className="btn btn-primary"
            >
              Gửi xác minh địa điểm
            </button>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--surface-alt)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <span className="badge badge-tint" style={{ marginBottom: '10px' }}>Theo quyền workspace</span>
            <h4 style={{ margin: '0 0 8px' }}>Thông tin đang lưu</h4>
            <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'var(--muted)' }}>
              Địa điểm: <strong>{venueEditName}</strong>
              <br />
              Loại hình: {venueEditType}
              <br />
              Địa chỉ: {venueEditAddress}
            </p>
          </div>
        </div>
      )}

      {/* 125:7531 | o-venue-pending & 156:9073 | o-venue-bensong-pending */}
      {studioTab === 'o-venue-pending' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div>
              <span className="tag-overline">125:7531 · o-venue-pending & 156:9073 · o-venue-bensong-pending</span>
              <h3 style={{ margin: 0, fontSize: '20px' }}>
                Hồ sơ xác minh địa điểm · {venueEditName}
              </h3>
            </div>
            <span className={`badge ${venueVerifyStatus === 'APPROVED' ? 'badge-success' : 'badge-warning'}`}>
              {venueVerifyStatus === 'APPROVED' ? 'Đã xác minh địa điểm' : 'Đang chờ Admin xác minh'}
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
            Tài liệu đã nộp: {venueDocs.join(', ')} • Địa chỉ: {venueEditAddress}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => setStudioTab('o-layout-standing')} className="btn btn-primary">
              Thiết lập sơ đồ cho địa điểm này
            </button>
            <button type="button" onClick={() => setStudioTab('o-venue-edit')} className="btn btn-outline">
              Cập nhật giấy phép địa điểm
            </button>
            <button
              type="button"
              onClick={() => setVenueVerifyStatus((s) => (s === 'APPROVED' ? 'PENDING' : 'APPROVED'))}
              className="btn btn-outline"
            >
              {venueVerifyStatus === 'APPROVED' ? 'Đặt lại Chờ xác minh' : 'Phê duyệt nhanh địa điểm'}
            </button>
          </div>
        </div>
      )}

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
