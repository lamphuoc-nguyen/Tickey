import { useState, useMemo } from 'react';
import {
  detectTemplateType,
  createTemplateZones,
  nextZoneId,
  rowLabel,
  zoneCapacity,
  SPACING,
  toDefinition,
  type EditorZone,
  type VenueTemplateType,
} from './layout-model';
import { LayoutTypePicker } from './LayoutTypePicker';

export interface LayoutEditorProps {
  zones: EditorZone[];
  onChange: (zones: EditorZone[]) => void;
  readOnly?: boolean;
  venueName?: string;
  venueCapacity?: number;
  onSaveDraft?: () => void;
  onPublish?: () => void;
  isSavingDraft?: boolean;
  isPublishing?: boolean;
  localErrors?: string[];
  serverErrors?: string[];
  onOpenTypePicker?: () => void;
}

export function LayoutEditor({
  zones,
  onChange,
  readOnly = false,
  venueName = 'SVĐ Thành Phố',
  venueCapacity = 0,
  onSaveDraft,
  onPublish,
  isSavingDraft = false,
  isPublishing = false,
  localErrors = [],
  serverErrors = [],
  onOpenTypePicker,
}: LayoutEditorProps) {
  // Detect current template type
  const currentType = useMemo(() => detectTemplateType(zones), [zones]);
  const [templateType, setTemplateType] = useState<VenueTemplateType>(currentType);
  const [selectedStandId, setSelectedStandId] = useState<string>('A');
  const [tier, setTier] = useState<string>('Tầng 1');
  const [showTypeModal, setShowTypeModal] = useState<boolean>(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Synchronize detected type if template changed
  const activeType = templateType || currentType;

  // Active zone depending on selection
  const activeZoneIndex = useMemo(() => {
    if (activeType === 'stadium') {
      const idx = zones.findIndex((z) => z.id === selectedStandId);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  }, [zones, activeType, selectedStandId]);

  const activeZone = zones[activeZoneIndex] || {
    id: 'A',
    name: 'Khu A',
    type: 'seated',
    rows: 6,
    seatsPerRow: 10,
    capacity: 0,
  };

  const totalSeats = useMemo(
    () => zones.reduce((sum, zone) => sum + zoneCapacity(zone), 0),
    [zones],
  );

  // Switch template
  const handleSwitchTemplate = (type: VenueTemplateType) => {
    setTemplateType(type);
    setShowTypeModal(false);
    const newZones = createTemplateZones(type);
    onChange(newZones);
    if (type === 'stadium') setSelectedStandId('A');
  };

  // Update specific zone properties
  const updateZone = (index: number, patch: Partial<EditorZone>) => {
    const next = zones.map((z, i) => (i === index ? { ...z, ...patch } : z));
    onChange(next);
  };

  // Update all stadium stands simultaneously
  const updateAllStadiumStands = (patch: Partial<EditorZone>) => {
    const next = zones.map((z) => (z.type === 'seated' ? { ...z, ...patch } : z));
    onChange(next);
  };

  // Aisle split point: divide row into left/right blocks
  const aisleIndex = Math.ceil(activeZone.seatsPerRow / 2);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Template Switcher Modal */}
      {showTypeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowTypeModal(false)}
        >
          <div
            style={{ maxWidth: 900, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <LayoutTypePicker
              onSelect={handleSwitchTemplate}
              onBack={() => setShowTypeModal(false)}
            />
          </div>
        </div>
      )}

      {/* Main 2-column Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 340px',
          gap: 20,
          alignItems: 'start',
        }}
      >
        {/* Left Column: Visual Canvas & Seat Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card 1: Overview Visual Header */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                {venueName} / {activeType === 'stadium' ? 'Khán đài' : activeZone.name}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                {activeType === 'stadium' && `Sân vận động · ${zones.length} khán đài · ${totalSeats} ghế${venueCapacity > 0 ? ` · Sức chứa: ${venueCapacity.toLocaleString('vi-VN')}` : ''}`}
                {activeType === 'cinema' && `Rạp phim · ${activeZone.rows} hàng × ${activeZone.seatsPerRow} ghế · ${totalSeats} ghế${venueCapacity > 0 ? ` · Sức chứa: ${venueCapacity.toLocaleString('vi-VN')}` : ''}`}
                {activeType === 'theater' && `Nhà hát · ${zones.length} khu ghế · ${totalSeats} ghế${venueCapacity > 0 ? ` · Sức chứa: ${venueCapacity.toLocaleString('vi-VN')}` : ''}`}
                {activeType === 'standing' && `Không gian sự kiện · ${totalSeats} chỗ đứng${venueCapacity > 0 ? ` · Sức chứa: ${venueCapacity.toLocaleString('vi-VN')}` : ''}`}
              </div>
            </div>

            {/* Stadium Visual Overview */}
            {activeType === 'stadium' && (
              <div
                style={{
                  background: '#F9FAFB',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)',
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <svg viewBox="0 0 460 250" style={{ width: '100%', maxWidth: 520, height: 'auto' }}>
                  {/* Soccer Pitch */}
                  <rect x="135" y="70" width="190" height="110" rx="6" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.6" />
                  <line x1="230" y1="70" x2="230" y2="180" stroke="#10B981" strokeWidth="1.4" />
                  <circle cx="230" cy="125" r="28" fill="none" stroke="#10B981" strokeWidth="1.4" />
                  <circle cx="230" cy="125" r="2.5" fill="#10B981" />
                  {/* Left penalty box */}
                  <rect x="135" y="93" width="32" height="64" fill="none" stroke="#10B981" strokeWidth="1.2" />
                  <path d="M 167 113 A 18 18 0 0 1 167 137" fill="none" stroke="#10B981" strokeWidth="1.2" />
                  {/* Right penalty box */}
                  <rect x="293" y="93" width="32" height="64" fill="none" stroke="#10B981" strokeWidth="1.2" />
                  <path d="M 293 113 A 18 18 0 0 0 293 137" fill="none" stroke="#10B981" strokeWidth="1.2" />
                  {/* Center Text */}
                  <text
                    x="230"
                    y="128"
                    textAnchor="middle"
                    fill="#047857"
                    fontSize="8.5"
                    fontWeight="700"
                    letterSpacing="0.8px"
                    opacity="0.85"
                  >
                    VÒNG TRUNG TÂM
                  </text>

                  {/* Top Stand A */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedStandId('A')}
                  >
                    <path
                      d="M 120 54 Q 230 36 340 54 L 325 66 Q 230 50 135 66 Z"
                      fill={selectedStandId === 'A' ? '#EA580C' : '#FDBA74'}
                      stroke={selectedStandId === 'A' ? '#C2410C' : 'none'}
                      strokeWidth={selectedStandId === 'A' ? 2 : 0}
                      opacity={selectedStandId === 'A' ? 1 : 0.85}
                    />
                    <text
                      x="230"
                      y="53"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="11"
                      fontWeight="800"
                    >
                      A
                    </text>
                  </g>

                  {/* Bottom Stand C */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedStandId('C')}
                  >
                    <path
                      d="M 120 196 Q 230 214 340 196 L 325 184 Q 230 200 135 184 Z"
                      fill={selectedStandId === 'C' ? '#0284C7' : '#93C5FD'}
                      stroke={selectedStandId === 'C' ? '#0369A1' : 'none'}
                      strokeWidth={selectedStandId === 'C' ? 2 : 0}
                      opacity={selectedStandId === 'C' ? 1 : 0.85}
                    />
                    <text
                      x="230"
                      y="204"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="11"
                      fontWeight="800"
                    >
                      C
                    </text>
                  </g>

                  {/* Left Stand D */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedStandId('D')}
                  >
                    <path
                      d="M 116 62 Q 95 125 116 188 L 130 178 Q 112 125 130 72 Z"
                      fill={selectedStandId === 'D' ? '#7C3AED' : '#C4B5FD'}
                      stroke={selectedStandId === 'D' ? '#6D28D9' : 'none'}
                      strokeWidth={selectedStandId === 'D' ? 2 : 0}
                      opacity={selectedStandId === 'D' ? 1 : 0.85}
                    />
                    <text
                      x="115"
                      y="129"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="11"
                      fontWeight="800"
                    >
                      D
                    </text>
                  </g>

                  {/* Right Stand B */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedStandId('B')}
                  >
                    <path
                      d="M 344 62 Q 365 125 344 188 L 330 178 Q 348 125 330 72 Z"
                      fill={selectedStandId === 'B' ? '#DC2626' : '#FCA5A5'}
                      stroke={selectedStandId === 'B' ? '#B91C1C' : 'none'}
                      strokeWidth={selectedStandId === 'B' ? 2 : 0}
                      opacity={selectedStandId === 'B' ? 1 : 0.85}
                    />
                    <text
                      x="345"
                      y="129"
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="11"
                      fontWeight="800"
                    >
                      B
                    </text>
                  </g>
                </svg>
              </div>
            )}

            {/* Cinema Screen Banner */}
            {activeType === 'cinema' && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    background: '#111827',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 20px',
                    textAlign: 'center',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '4px',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
                  }}
                >
                  MÀN CHIẾU
                </div>
              </div>
            )}

            {/* Theater Stage Banner */}
            {activeType === 'theater' && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    background: '#1F2937',
                    borderRadius: '4px 4px 20px 20px',
                    padding: '14px 24px',
                    textAlign: 'center',
                    color: '#FFFFFF',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '3px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                  }}
                >
                  SÂN KHẤU BIỂU DIỄN
                </div>
              </div>
            )}

            {/* Standing Open Areas */}
            {activeType === 'standing' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                {zones.map((zone, idx) => (
                  <div
                    key={zone.id}
                    style={{
                      background: idx % 2 === 0 ? '#ECFDF5' : '#FFF7ED',
                      border: `1.5px dashed ${idx % 2 === 0 ? '#10B981' : '#F97316'}`,
                      borderRadius: 'var(--radius-md)',
                      padding: '24px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 16, color: idx % 2 === 0 ? '#047857' : '#C2410C' }}>
                      {zone.name}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                      Sức chứa: <strong>{zone.capacity}</strong> người
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card 2: Interactive Seat Grid Detail */}
          {activeZone.type === 'seated' && (
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)' }}>
                  {activeZone.name} {activeType === 'stadium' ? `- ${tier}` : ''}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                  Mỗi {activeZone.rows} hàng × {activeZone.seatsPerRow} ghế. Thêm tầng hoặc khu để mở rộng sơ đồ.
                </div>
              </div>

              {/* Seat Matrix */}
              <div
                style={{
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  padding: '20px 16px',
                  overflowX: 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    alignItems: 'center',
                    minWidth: activeZone.seatsPerRow * 36 + 80,
                  }}
                >
                  {Array.from({ length: activeZone.rows }).map((_, rIdx) => {
                    const rowChar = rowLabel(rIdx);
                    return (
                      <div
                        key={rowChar}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {/* Row letter */}
                        <div
                          style={{
                            width: 28,
                            textAlign: 'right',
                            fontSize: 12,
                            fontWeight: 700,
                            color: 'var(--muted)',
                            marginRight: 8,
                          }}
                        >
                          {rowChar}
                        </div>

                        {/* Seats with middle aisle */}
                        {Array.from({ length: activeZone.seatsPerRow }).map((_, sIdx) => {
                          const seatNum = sIdx + 1;
                          const isAisleSplit = sIdx === aisleIndex && activeZone.seatsPerRow >= 8;

                          return (
                            <div
                              key={seatNum}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                              }}
                            >
                              {/* Walkway/Aisle spacing */}
                              {isAisleSplit && <div style={{ width: 24 }} />}

                              {/* Seat Box */}
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 6,
                                  background: '#FFFFFF',
                                  border: '1px solid #D5D9DA',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  color: '#374151',
                                  userSelect: 'none',
                                  transition: 'all 0.15s ease',
                                }}
                                title={`${activeZone.name} · Hàng ${rowChar} · Ghế ${seatNum}`}
                              >
                                {seatNum}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 14 }}>
                Mỗi ghế có mã khu, hàng và số ghế riêng. Chừa lối đi theo bố trí thực tế.
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Properties Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: '22px 20px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
              Thuộc tính sơ đồ
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Loại hình địa điểm */}
              <label>
                Loại hình địa điểm
                <select
                  className="form-select"
                  value={activeType}
                  disabled={readOnly}
                  onChange={(e) => handleSwitchTemplate(e.target.value as VenueTemplateType)}
                >
                  <option value="stadium">Sân vận động</option>
                  <option value="theater">Nhà hát</option>
                  <option value="cinema">Rạp phim</option>
                  <option value="standing">Không có ghế</option>
                </select>
              </label>

              {/* Stadium specific fields */}
              {activeType === 'stadium' && (
                <>
                  <label>
                    Khán đài đang chỉnh sửa
                    <select
                      className="form-select"
                      value={selectedStandId}
                      disabled={readOnly}
                      onChange={(e) => setSelectedStandId(e.target.value)}
                    >
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Tầng
                    <select
                      className="form-select"
                      value={tier}
                      disabled={readOnly}
                      onChange={(e) => setTier(e.target.value)}
                    >
                      <option value="Tầng 1">Tầng 1</option>
                      <option value="Tầng 2">Tầng 2</option>
                      <option value="Tầng 3">Tầng 3</option>
                    </select>
                  </label>

                  <label>
                    Số hàng
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={50}
                      value={activeZone.rows}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateAllStadiumStands({ rows: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>

                  <label>
                    Số ghế mỗi hàng
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={100}
                      value={activeZone.seatsPerRow}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateAllStadiumStands({ seatsPerRow: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>

                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                    Tổng mẫu: {zones.length} khán đài × {activeZone.rows * activeZone.seatsPerRow} ghế ={' '}
                    <strong>{totalSeats} ghế</strong>.
                  </div>
                </>
              )}

              {/* Cinema specific fields */}
              {activeType === 'cinema' && (
                <>
                  <label>
                    Tên phòng
                    <input
                      className="form-input"
                      value={activeZone.name}
                      disabled={readOnly}
                      onChange={(e) => updateZone(activeZoneIndex, { name: e.target.value })}
                    />
                  </label>

                  <label>
                    Số hàng
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={50}
                      value={activeZone.rows}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateZone(activeZoneIndex, { rows: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>

                  <label>
                    Số ghế mỗi hàng
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={100}
                      value={activeZone.seatsPerRow}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateZone(activeZoneIndex, {
                          seatsPerRow: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>

                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                    Tổng mẫu: {activeZone.rows} hàng × {activeZone.seatsPerRow} ghế ={' '}
                    <strong>{totalSeats} ghế</strong>.
                  </div>
                </>
              )}

              {/* Theater specific fields */}
              {activeType === 'theater' && (
                <>
                  <label>
                    Khu vực đang chỉnh sửa
                    <select
                      className="form-select"
                      value={activeZone.id}
                      disabled={readOnly}
                      onChange={(e) => {
                        const idx = zones.findIndex((z) => z.id === e.target.value);
                        if (idx >= 0) setSelectedStandId(e.target.value);
                      }}
                    >
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Số hàng
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={50}
                      value={activeZone.rows}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateZone(activeZoneIndex, { rows: Math.max(1, Number(e.target.value) || 1) })
                      }
                    />
                  </label>

                  <label>
                    Số ghế mỗi hàng
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      max={100}
                      value={activeZone.seatsPerRow}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateZone(activeZoneIndex, {
                          seatsPerRow: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>

                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                    Tổng mẫu: <strong>{totalSeats} ghế</strong>.
                  </div>
                </>
              )}

              {/* Standing specific fields */}
              {activeType === 'standing' && (
                <>
                  <label>
                    Khu vực đang chỉnh sửa
                    <select
                      className="form-select"
                      value={activeZone.id}
                      disabled={readOnly}
                      onChange={(e) => {
                        const idx = zones.findIndex((z) => z.id === e.target.value);
                        if (idx >= 0) setSelectedStandId(e.target.value);
                      }}
                    >
                      {zones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Tên khu vực
                    <input
                      className="form-input"
                      value={activeZone.name}
                      disabled={readOnly}
                      onChange={(e) => updateZone(activeZoneIndex, { name: e.target.value })}
                    />
                  </label>

                  <label>
                    Sức chứa (người)
                    <input
                      className="form-input"
                      type="number"
                      min={1}
                      value={activeZone.capacity}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateZone(activeZoneIndex, {
                          capacity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </label>

                  <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                    Tổng sức chứa: <strong>{totalSeats} chỗ đứng</strong>.
                  </div>
                </>
              )}

              {/* Error messages if any */}
              {!!(serverErrors.length || localErrors.length) && (
                <div
                  style={{
                    background: 'var(--danger-bg)',
                    color: 'var(--danger)',
                    padding: 10,
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                    lineHeight: 1.4,
                  }}
                >
                  {(serverErrors.length ? serverErrors : localErrors).map((e) => (
                    <div key={e}>• {e}</div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              {!readOnly && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                  {onSaveDraft && (
                    <button
                      type="button"
                      className="btn"
                      disabled={isSavingDraft}
                      onClick={onSaveDraft}
                      style={{
                        backgroundColor: '#E2553B',
                        color: '#FFFFFF',
                        fontWeight: 600,
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      {isSavingDraft ? 'Đang lưu…' : 'Lưu nháp'}
                    </button>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => (onOpenTypePicker ? onOpenTypePicker() : setShowTypeModal(true))}
                      style={{ fontSize: 12.5, padding: '9px 12px' }}
                    >
                      Đổi loại hình
                    </button>

                    {onPublish && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={isSavingDraft || isPublishing || localErrors.length > 0}
                        onClick={onPublish}
                        style={{ fontSize: 12.5, padding: '9px 12px' }}
                      >
                        {isPublishing ? 'Đang gửi…' : 'Kiểm tra & phát hành'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.4 }}>
                Sơ đồ mới ở trạng thái bản nháp. Phát hành sơ đồ trước khi dùng cho suất diễn.
              </div>

              {/* Advanced Zone Editor Toggle */}
              {!readOnly && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginTop: 4 }}>
                  <button
                    type="button"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: 0,
                      fontWeight: 600,
                    }}
                    onClick={() => setShowAdvanced((p) => !p)}
                  >
                    {showAdvanced ? '− Thu gọn danh sách khu vực' : '+ Tùy chỉnh chi tiết từng khu vực'}
                  </button>

                  {showAdvanced && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                      {zones.map((zone, idx) => (
                        <div
                          key={zone.id}
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: 8,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{zone.name}</strong> ({zone.id})
                            {zones.length > 1 && (
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--danger)',
                                  cursor: 'pointer',
                                  fontSize: 11,
                                }}
                                onClick={() => onChange(zones.filter((_, i) => i !== idx))}
                              >
                                Xóa
                              </button>
                            )}
                          </div>
                          <div style={{ color: 'var(--muted)', marginTop: 2 }}>
                            {zone.type === 'seated'
                              ? `${zone.rows} hàng × ${zone.seatsPerRow} ghế = ${zone.rows * zone.seatsPerRow} ghế`
                              : `${zone.capacity} chỗ đứng`}
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 11.5, padding: '4px 8px' }}
                        onClick={() => {
                          const nextId = nextZoneId(zones);
                          onChange([
                            ...zones,
                            {
                              id: nextId,
                              name: `Khu ${nextId}`,
                              type: 'seated',
                              rows: 5,
                              seatsPerRow: 10,
                              capacity: 0,
                            },
                          ]);
                        }}
                      >
                        + Thêm khu mới
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Retained for backward compatibility */
export function LayoutPreview({ zones }: { zones: EditorZone[] }) {
  const definition = toDefinition(zones.filter((zone) => zoneCapacity(zone) > 0));
  const seated = definition.zones.flatMap((zone) => (zone.type === 'seated' ? zone.seats : []));
  const width = Math.max(300, ...seated.map((seat) => seat.x + SPACING));
  const seatedHeight = Math.max(0, ...seated.map((seat) => seat.y + SPACING));
  const standing = definition.zones.filter((zone) => zone.type === 'standing');
  const height = seatedHeight + standing.length * 70 + 50;
  const total = zones.reduce((sum, zone) => sum + zoneCapacity(zone), 0);

  return (
    <div className="card" style={{ padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
        <strong>Xem trước</strong>
        <span style={{ color: 'var(--muted)' }}>Tổng sức chứa: {total}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', maxHeight: 420, background: '#FAF9F6', borderRadius: 8 }}
      >
        <rect x={width * 0.2} y={8} width={width * 0.6} height={22} rx={6} fill="#1F2937" />
        <text x={width / 2} y={23} textAnchor="middle" fontSize={11} fill="#FFFFFF">
          SÂN KHẤU
        </text>
        <g transform="translate(0 46)">
          {definition.zones.map((zone) =>
            zone.type === 'seated'
              ? zone.seats.map((seat) => (
                  <circle
                    key={seat.id}
                    cx={seat.x}
                    cy={seat.y}
                    r={10}
                    fill={(zone as { color?: string }).color}
                  >
                    <title>{`${zone.name} · ${seat.row}${seat.number}`}</title>
                  </circle>
                ))
              : null,
          )}
          {standing.map((zone, index) => (
            <g key={zone.id} transform={`translate(${SPACING} ${seatedHeight + index * 70})`}>
              <rect
                width={width - SPACING * 2}
                height={56}
                rx={10}
                fill={(zone as { color?: string }).color}
                opacity={0.85}
              />
              <text x={(width - SPACING * 2) / 2} y={33} textAnchor="middle" fontSize={14} fill="#FFFFFF">
                {zone.name} · {zone.capacity} chỗ đứng
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
