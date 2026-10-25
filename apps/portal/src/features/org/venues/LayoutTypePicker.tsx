import type { VenueTemplateType } from './layout-model';

export function LayoutTypePicker({
  onSelect,
  onBack,
}: {
  onSelect: (type: VenueTemplateType) => void;
  onBack?: () => void;
}) {
  return (
    <div className="card" style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text)' }}>
          Chọn mẫu sơ đồ theo địa điểm thực tế
        </h2>
        <div style={{ fontSize: 13.5, color: 'var(--muted)' }}>
          Bạn có thể chỉnh sửa khu vực, hàng ghế và lối đi sau khi chọn mẫu.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
          marginBottom: 28,
        }}
      >
        {/* Sân vận động */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect('stadium')}
          onKeyDown={(e) => e.key === 'Enter' && onSelect('stadium')}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            background: 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(217, 66, 45, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            style={{
              height: 140,
              background: '#F9FAFB',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              padding: 10,
            }}
          >
            <svg viewBox="0 0 240 120" style={{ width: '100%', maxHeight: 120 }}>
              {/* Pitch */}
              <rect x="75" y="32" width="90" height="56" rx="4" fill="#D1FAE5" stroke="#10B981" strokeWidth="1.5" />
              <line x1="120" y1="32" x2="120" y2="88" stroke="#10B981" strokeWidth="1.2" />
              <circle cx="120" cy="60" r="14" fill="none" stroke="#10B981" strokeWidth="1.2" />
              <rect x="75" y="44" width="16" height="32" fill="none" stroke="#10B981" strokeWidth="1" />
              <rect x="149" y="44" width="16" height="32" fill="none" stroke="#10B981" strokeWidth="1" />
              {/* Top stand A */}
              <path d="M 65 24 Q 120 12 175 24 L 170 30 Q 120 20 70 30 Z" fill="#FDBA74" opacity="0.9" />
              {/* Bottom stand C */}
              <path d="M 65 96 Q 120 108 175 96 L 170 90 Q 120 100 70 90 Z" fill="#93C5FD" opacity="0.9" />
              {/* Left stand D */}
              <path d="M 60 28 Q 45 60 60 92 L 68 88 Q 55 60 68 32 Z" fill="#D8B4FE" opacity="0.9" />
              {/* Right stand B */}
              <path d="M 180 28 Q 195 60 180 92 L 172 88 Q 185 60 172 32 Z" fill="#FCA5A5" opacity="0.9" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>Sân vận động</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Khán đài, tầng và từng khu ghế.
            </div>
            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>Chọn mẫu →</div>
          </div>
        </div>

        {/* Nhà hát */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect('theater')}
          onKeyDown={(e) => e.key === 'Enter' && onSelect('theater')}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            background: 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(217, 66, 45, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            style={{
              height: 140,
              background: '#F9FAFB',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              padding: 10,
            }}
          >
            <svg viewBox="0 0 240 120" style={{ width: '100%', maxHeight: 120 }}>
              {/* Stage */}
              <rect x="65" y="14" width="110" height="18" rx="4" fill="#1E293B" />
              <text x="120" y="27" textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="700">
                SÂN KHẤU
              </text>
              {/* Curved rows of theater seats */}
              {[42, 56, 70, 84, 98].map((y, rowIdx) => (
                <g key={y}>
                  {Array.from({ length: 12 }).map((_, colIdx) => {
                    const x = 50 + colIdx * 12 + (colIdx >= 6 ? 10 : 0);
                    return (
                      <rect
                        key={colIdx}
                        x={x}
                        y={y}
                        width="8"
                        height="8"
                        rx="2"
                        fill={rowIdx < 2 ? '#EF4444' : '#E2E8F0'}
                      />
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>Nhà hát</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Sân khấu, khu ghế và hàng ghế.
            </div>
            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>Chọn mẫu →</div>
          </div>
        </div>

        {/* Rạp phim */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect('cinema')}
          onKeyDown={(e) => e.key === 'Enter' && onSelect('cinema')}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            background: 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(217, 66, 45, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            style={{
              height: 140,
              background: '#F9FAFB',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              padding: 10,
            }}
          >
            <svg viewBox="0 0 240 120" style={{ width: '100%', maxHeight: 120 }}>
              {/* Screen curve */}
              <path d="M 50 18 Q 120 28 190 18" stroke="#111827" strokeWidth="6" strokeLinecap="round" fill="none" />
              {/* Cinema seats with center aisle */}
              {[38, 52, 66, 80, 94].map((y, rowIdx) => (
                <g key={y}>
                  {Array.from({ length: 12 }).map((_, colIdx) => {
                    const x = 50 + colIdx * 11 + (colIdx >= 6 ? 16 : 0);
                    return (
                      <rect
                        key={colIdx}
                        x={x}
                        y={y}
                        width="8"
                        height="8"
                        rx="2"
                        fill={rowIdx === 4 ? '#EF4444' : '#CBD5E1'}
                      />
                    );
                  })}
                </g>
              ))}
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>Rạp phim</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Màn chiếu, phòng chiếu và lối đi.
            </div>
            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>Chọn mẫu →</div>
          </div>
        </div>

        {/* Không có ghế */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => onSelect('standing')}
          onKeyDown={(e) => e.key === 'Enter' && onSelect('standing')}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: 20,
            background: 'var(--surface)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(217, 66, 45, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <div
            style={{
              height: 140,
              background: '#F9FAFB',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
              padding: 10,
            }}
          >
            <svg viewBox="0 0 240 120" style={{ width: '100%', maxHeight: 120 }}>
              {/* Stage bar */}
              <rect x="50" y="16" width="140" height="14" rx="4" fill="#1E293B" />
              {/* Standing block 1 */}
              <rect
                x="50"
                y="38"
                width="78"
                height="62"
                rx="6"
                fill="#D1FAE5"
                stroke="#10B981"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <text x="89" y="73" textAnchor="middle" fill="#047857" fontSize="10" fontWeight="600">
                Khu A (Đứng)
              </text>
              {/* Standing block 2 */}
              <rect
                x="136"
                y="38"
                width="54"
                height="62"
                rx="6"
                fill="#FFEDD5"
                stroke="#F97316"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
              <text x="163" y="73" textAnchor="middle" fill="#C2410C" fontSize="10" fontWeight="600">
                Khu B
              </text>
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>Không có ghế</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Khu vực mở/sức chứa, không đánh số ghế.
            </div>
            <div style={{ color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>Chọn mẫu →</div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          paddingTop: 16,
          borderTop: '1px solid var(--border)',
        }}
      >
        {onBack ? (
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            ← Quay lại danh sách
          </button>
        ) : (
          <div />
        )}
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>
          Lưu ý hình giúp chọn mẫu, khu không ghế được quản lý bằng sức chứa.
        </div>
      </div>
    </div>
  );
}
