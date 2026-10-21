import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  RotateCcw,
  Search,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import {
  FigmaPageHeader,
  FigmaHeroBanner,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaInfoAlert,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const VENUE_SCREENS: FigmaScreenOption[] = [
  { id: 'o-venues', label: 'Địa điểm của Ánh Trăng Events' },
  { id: 'o-venue-edit', label: 'Thông tin & xác minh địa điểm' },
  { id: 'o-venue-pending', label: 'Gửi xác minh địa điểm' },
  { id: 'o-venue-bensong', label: 'Hồ sơ địa điểm · Sân khấu Bến Sông' },
  { id: 'o-venue-bensong-pending', label: 'Sân khấu Bến Sông · Chờ xác minh' },
  { id: 'o-venue-create', label: 'Thêm địa điểm mới' },
  { id: 'o-layouts', label: 'Sơ đồ địa điểm' },
  { id: 'o-layout-type', label: 'Chọn loại hình địa điểm' },
  { id: 'o-layout-editor', label: 'Chỉnh sửa sơ đồ ghế' },
  { id: 'o-layout-standing', label: 'Cấu hình khu không có ghế' },
  { id: 'o-layout-stadium', label: 'Sơ đồ sân vận động' },
  { id: 'o-layout-cinema', label: 'Sơ đồ rạp phim' },
  { id: 'o-layout-change', label: 'Đổi loại hình địa điểm' },
  { id: 'o-layout-publish', label: 'Kiểm tra & phát hành sơ đồ' },
  { id: 'o-layout-published', label: 'Phát hành sơ đồ thành công' },
  { id: 'o-layout-history', label: 'Lịch sử sơ đồ' },
];

const THEATER_ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const THEATER_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

function StadiumTemplateIllustration() {
  return (
    <svg width="260" height="120" viewBox="0 0 260 120" fill="none">
      {/* Top-left stand */}
      <path
        d="M36 48 C48 22, 82 14, 122 14 L118 32 C86 32, 62 38, 52 54 Z"
        fill="#EBF0FA"
      />
      {/* Top-right stand (coral highlight) */}
      <path
        d="M138 14 C178 14, 212 22, 224 48 L208 54 C198 38, 174 32, 142 32 Z"
        fill="#FBEAE5"
      />
      {/* Bottom-left stand */}
      <path
        d="M52 66 C62 82, 86 88, 118 88 L122 106 C82 106, 48 98, 36 72 Z"
        fill="#EBF0FA"
      />
      {/* Bottom-right stand */}
      <path
        d="M208 66 L224 72 C212 98, 178 106, 138 106 L142 88 C174 88, 198 82, 208 66 Z"
        fill="#EBF0FA"
      />
      {/* Center soccer pitch */}
      <rect
        x="76"
        y="37"
        width="108"
        height="46"
        rx="4"
        fill="#EAF5EF"
        stroke="#4D9A73"
        strokeWidth="1.2"
      />
      <line x1="130" y1="37" x2="130" y2="83" stroke="#4D9A73" strokeWidth="1" />
      <circle cx="130" cy="60" r="9" fill="none" stroke="#4D9A73" strokeWidth="1" />
      <rect
        x="76"
        y="48"
        width="15"
        height="24"
        fill="none"
        stroke="#4D9A73"
        strokeWidth="1"
      />
      <rect
        x="169"
        y="48"
        width="15"
        height="24"
        fill="none"
        stroke="#4D9A73"
        strokeWidth="1"
      />
    </svg>
  );
}

function TheaterTemplateIllustration() {
  const cols = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const rows = [0, 1, 2, 3, 4];
  return (
    <svg width="260" height="120" viewBox="0 0 260 120" fill="none">
      <rect x="64" y="10" width="132" height="14" rx="5" fill="#172A35" />
      {rows.map((r) =>
        cols.map((c) => {
          const x = 28 + c * 21;
          const archOffset = Math.abs(4.5 - c) * 1.1;
          const y = 36 + r * 15 + archOffset;
          const isFirstRow = r === 0;
          return (
            <rect
              key={`${r}-${c}`}
              x={x}
              y={y}
              width="13"
              height="10"
              rx="3"
              fill={isFirstRow ? '#D34528' : '#E2DDD6'}
            />
          );
        }),
      )}
    </svg>
  );
}

function CinemaTemplateIllustration() {
  const leftCols = [0, 1, 2, 3, 4];
  const rightCols = [0, 1, 2, 3, 4];
  const rows = [0, 1, 2, 3, 4];
  return (
    <svg width="260" height="120" viewBox="0 0 260 120" fill="none">
      <path
        d="M32 18 Q130 8 228 18"
        stroke="#172A35"
        strokeWidth="4"
        strokeLinecap="round"
      />
      {rows.map((r) => {
        const isHighlight = r === 2;
        return (
          <g key={r}>
            {leftCols.map((c) => (
              <rect
                key={`l-${c}`}
                x={44 + c * 16}
                y={34 + r * 15}
                width="11"
                height="10"
                rx="2.5"
                fill={isHighlight ? '#D34528' : '#E2DDD6'}
              />
            ))}
            {rightCols.map((c) => (
              <rect
                key={`r-${c}`}
                x={140 + c * 16}
                y={34 + r * 15}
                width="11"
                height="10"
                rx="2.5"
                fill={isHighlight ? '#D34528' : '#E2DDD6'}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

function StandingTemplateIllustration() {
  return (
    <svg width="260" height="120" viewBox="0 0 260 120" fill="none">
      <rect x="34" y="12" width="192" height="13" rx="4" fill="#172A35" />
      <rect
        x="34"
        y="36"
        width="116"
        height="68"
        rx="8"
        fill="#EAF5EF"
        stroke="#4D9A73"
        strokeWidth="1.2"
      />
      <rect
        x="160"
        y="36"
        width="66"
        height="68"
        rx="8"
        fill="#FBEAE5"
        stroke="#DF6B52"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function OrgVenuesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, createVenue, deleteVenue, submitVenueVerification, publishLayout } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-venues';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  // o-venue-edit state
  const [nhName, setNhName] = useState('Nhà hát Ánh Trăng');
  const [nhAddr, setNhAddr] = useState('128 Nguyễn Văn Cừ, TP. Hồ Chí Minh');
  const [nhSpaceModel, setNhSpaceModel] = useState('Có ghế · Từng khu');
  const [nhContact, setNhContact] = useState('Lê Minh Khoa · 0909 223 344');
  const [nhDoc1] = useState('hop-dong-su-dung.pdf');
  const [nhDoc2] = useState('giay-phep-to-chuc.pdf');

  // o-venue-bensong state
  const [bsName, setBsName] = useState('Sân khấu Bến Sông');
  const [bsAddr, setBsAddr] = useState('Khu đô thị Thủ Thiêm, TP. Thủ Đức');
  const [bsType, setBsType] = useState('Không ghế · Khu vực sức chứa');
  const [bsDoc, setBsDoc] = useState('GiayPhepSuDungMatBang_BenSong.pdf');

  // o-venue-create state
  const [newName, setNewName] = useState('');
  const [newCity, setNewCity] = useState('TP. Hồ Chí Minh');
  const [newAddr, setNewAddr] = useState('');
  const [newType, setNewType] = useState('Nhà hát');
  const [newDoc, setNewDoc] = useState('hop-dong-thue-dia-diem.pdf');

  // o-layout-editor (Theater) state
  const [selectedTheaterSeats, setSelectedTheaterSeats] = useState<string[]>(['A05', 'A06']);
  const [theaterZoneName, setTheaterZoneName] = useState('Khu A');
  const [theaterZoneType, setTheaterZoneType] = useState('Có ghế');
  const [theaterGridSpec, setTheaterGridSpec] = useState('8 × 10');
  const [theaterSeatGap, setTheaterSeatGap] = useState('40');

  // o-layout-standing state
  const [standingZoneName, setStandingZoneName] = useState('General Admission');
  const [standingZoneType, setStandingZoneType] = useState('Khu đứng');
  const [standingCapacity, setStandingCapacity] = useState('200');

  // o-layout-stadium state
  const [activeStandCode, setActiveStandCode] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [stadiumStandName, setStadiumStandName] = useState('Khán đài A');
  const [stadiumFloor, setStadiumFloor] = useState('Tầng 1');
  const [stadiumRowsCount, setStadiumRowsCount] = useState(6);
  const [stadiumColsCount, setStadiumColsCount] = useState(10);
  const [selectedStadiumSeats, setSelectedStadiumSeats] = useState<string[]>([]);

  // o-layout-cinema state
  const [cinemaRoomName, setCinemaRoomName] = useState('Phòng chiếu 01');
  const [cinemaRowsCount, setCinemaRowsCount] = useState(7);
  const [cinemaColsCount, setCinemaColsCount] = useState(12);
  const [selectedCinemaSeats, setSelectedCinemaSeats] = useState<string[]>([]);

  // Active layout editor tracking so Publish / Back buttons know which template was edited
  const [lastEditedLayoutScreen, setLastEditedLayoutScreen] = useState<
    'o-layout-editor' | 'o-layout-stadium' | 'o-layout-cinema' | 'o-layout-standing'
  >('o-layout-editor');

  const [publishedTargets, setPublishedTargets] = useState<string[]>(['o-layout-editor']);

  const screenMeta = VENUE_SCREENS.find((s) => s.id === activeScreen) || VENUE_SCREENS[0];

  const openLayoutEditor = (
    target: 'o-layout-editor' | 'o-layout-stadium' | 'o-layout-cinema' | 'o-layout-standing',
  ) => {
    setLastEditedLayoutScreen(target);
    setScreen(target);
  };

  const handleLayoutTypeSelectChange = (val: string) => {
    if (val === 'Sân vận động') openLayoutEditor('o-layout-stadium');
    else if (val === 'Nhà hát') openLayoutEditor('o-layout-editor');
    else if (val === 'Rạp phim') openLayoutEditor('o-layout-cinema');
    else if (val === 'Không có ghế') openLayoutEditor('o-layout-standing');
  };

  const toggleTheaterSeat = (code: string) => {
    setSelectedTheaterSeats((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  };

  const toggleStadiumSeat = (code: string) => {
    setSelectedStadiumSeats((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  };

  const toggleCinemaSeat = (code: string) => {
    setSelectedCinemaSeats((prev) =>
      prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code],
    );
  };

  const stadiumPerStandSeats = Math.max(1, stadiumRowsCount) * Math.max(1, stadiumColsCount);
  const stadiumTotalSeats = stadiumPerStandSeats * 4;
  const cinemaTotalSeats = Math.max(1, cinemaRowsCount) * Math.max(1, cinemaColsCount);

  const layoutRows = [
    {
      id: 'l-theater',
      name: `Nhà hát / ${theaterZoneName === 'Khu A' ? 'Tầng trệt' : theaterZoneName}`,
      version: `v3 · 80 ghế`,
      status: publishedTargets.includes('o-layout-editor') ? 'Đã phát hành' : 'Bản nháp',
      target: 'o-layout-editor' as const,
    },
    {
      id: 'l-stadium',
      name: `Sân vận động / ${stadiumStandName}`,
      version: `v1 · ${stadiumTotalSeats} ghế`,
      status: publishedTargets.includes('o-layout-stadium') ? 'Đã phát hành' : 'Bản nháp',
      target: 'o-layout-stadium' as const,
    },
    {
      id: 'l-cinema',
      name: `Rạp phim / ${cinemaRoomName}`,
      version: `v1 · ${cinemaTotalSeats} ghế`,
      status: publishedTargets.includes('o-layout-cinema') ? 'Đã phát hành' : 'Bản nháp',
      target: 'o-layout-cinema' as const,
    },
    {
      id: 'l-standing',
      name: `Khu đứng / ${standingZoneName}`,
      version: `v1 · ${standingCapacity} người`,
      status: publishedTargets.includes('o-layout-standing') ? 'Đã phát hành' : 'Bản nháp',
      target: 'o-layout-standing' as const,
    },
  ].filter((item) => {
    const matchText =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.version.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || item.status === statusFilter;
    return matchText && matchStatus;
  });

  const isLayoutFlow = activeScreen.startsWith('o-layout');
  const currentEditorTarget:
    | 'o-layout-editor'
    | 'o-layout-stadium'
    | 'o-layout-cinema'
    | 'o-layout-standing' =
    activeScreen === 'o-layout-stadium' ||
    activeScreen === 'o-layout-cinema' ||
    activeScreen === 'o-layout-standing' ||
    activeScreen === 'o-layout-editor'
      ? activeScreen
      : lastEditedLayoutScreen;

  const publishSummary =
    currentEditorTarget === 'o-layout-stadium'
      ? {
          venueTitle: 'SVĐ Thành Phố',
          layoutName: `Sân vận động / ${stadiumStandName} (${stadiumFloor})`,
          typeName: 'Sân vận động',
          capacityLabel: `${stadiumTotalSeats} ghế`,
          versionLabel: 'v1',
        }
      : currentEditorTarget === 'o-layout-cinema'
        ? {
            venueTitle: 'Rạp Tickey',
            layoutName: `Rạp phim / ${cinemaRoomName}`,
            typeName: 'Rạp phim',
            capacityLabel: `${cinemaTotalSeats} ghế`,
            versionLabel: 'v1',
          }
        : currentEditorTarget === 'o-layout-standing'
          ? {
              venueTitle: 'Sân khấu Bến Sông',
              layoutName: `Khu đứng / ${standingZoneName}`,
              typeName: 'Không có ghế',
              capacityLabel: `${standingCapacity} người`,
              versionLabel: 'v1',
            }
          : {
              venueTitle: nhName,
              layoutName: 'Nhà hát / Tầng trệt',
              typeName: 'Nhà hát',
              capacityLabel: '80 ghế',
              versionLabel: 'v4',
            };

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={VENUE_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
        hideDefaultStepBar={true}
      />

      {/* Natural Step-by-Step Workflow Bar */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          marginBottom: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* Main Mode Switch: Địa điểm vs Sơ đồ ghế */}
          <div
            style={{
              display: 'inline-flex',
              background: '#F4EFE8',
              padding: 4,
              borderRadius: 10,
              gap: 4,
            }}
          >
            <button
              type="button"
              onClick={() => setScreen('o-venues')}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                background: !isLayoutFlow ? '#FFFFFF' : 'transparent',
                color: !isLayoutFlow ? 'var(--ink)' : 'var(--muted)',
                boxShadow: !isLayoutFlow ? '0 1px 3px rgba(20,18,16,0.08)' : 'none',
              }}
            >
              1. Quản lý Địa điểm
            </button>
            <button
              type="button"
              onClick={() => setScreen('o-layouts')}
              style={{
                border: 'none',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                background: isLayoutFlow ? '#FFFFFF' : 'transparent',
                color: isLayoutFlow ? 'var(--ink)' : 'var(--muted)',
                boxShadow: isLayoutFlow ? '0 1px 3px rgba(20,18,16,0.08)' : 'none',
              }}
            >
              2. Quản lý Sơ đồ ghế
            </button>
          </div>

          {/* Step-by-step Breadcrumb Flow */}
          {!isLayoutFlow ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'o-venues', label: 'Bước 1: Danh sách địa điểm', match: ['o-venues'] },
                {
                  id: 'o-venue-edit',
                  label: 'Bước 2: Hồ sơ & Xác minh',
                  match: [
                    'o-venue-edit',
                    'o-venue-bensong',
                    'o-venue-pending',
                    'o-venue-rejected',
                    'o-venue-bensong-pending',
                  ],
                },
                { id: 'o-venue-create', label: 'Thêm địa điểm mới', match: ['o-venue-create'] },
              ].map((step, idx, arr) => {
                const active = step.match.includes(activeScreen);
                return (
                  <div key={step.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setScreen(step.id)}
                      style={{
                        border: active ? '1px solid #F2C5B8' : '1px solid transparent',
                        background: active ? '#FDF0EC' : 'transparent',
                        color: active ? 'var(--brand)' : 'var(--muted)',
                        fontWeight: active ? 700 : 600,
                        fontSize: 12.5,
                        padding: '5px 11px',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      {step.label}
                    </button>
                    {idx < arr.length - 1 && (
                      <span style={{ color: '#C5BCB0', fontSize: 12 }}>→</span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {[
                { id: 'o-layouts', label: 'Bước 1: Danh sách sơ đồ', match: ['o-layouts'] },
                {
                  id: 'o-layout-type',
                  label: 'Bước 2: Chọn mẫu địa điểm',
                  match: ['o-layout-type', 'o-layout-change'],
                },
                {
                  id: currentEditorTarget,
                  label: 'Bước 3: Thiết kế sơ đồ',
                  match: [
                    'o-layout-stadium',
                    'o-layout-editor',
                    'o-layout-cinema',
                    'o-layout-standing',
                  ],
                },
                {
                  id: 'o-layout-publish',
                  label: 'Bước 4: Lưu & Phát hành',
                  match: ['o-layout-publish', 'o-layout-published'],
                },
                {
                  id: 'o-layout-history',
                  label: 'Lịch sử phiên bản',
                  match: ['o-layout-history'],
                },
              ].map((step, idx, arr) => {
                const active = step.match.includes(activeScreen);
                return (
                  <div key={step.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setScreen(step.id)}
                      style={{
                        border: active ? '1px solid #F2C5B8' : '1px solid transparent',
                        background: active ? '#FDF0EC' : 'transparent',
                        color: active ? 'var(--brand)' : 'var(--muted)',
                        fontWeight: active ? 700 : 600,
                        fontSize: 12.5,
                        padding: '5px 11px',
                        borderRadius: 8,
                        cursor: 'pointer',
                      }}
                    >
                      {step.label}
                    </button>
                    {idx < arr.length - 2 && (
                      <span style={{ color: '#C5BCB0', fontSize: 12 }}>→</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sub-bar when inside Step 3 (Thiết kế sơ đồ) so user can switch between the 4 venue templates effortlessly */}
        {(activeScreen === 'o-layout-stadium' ||
          activeScreen === 'o-layout-editor' ||
          activeScreen === 'o-layout-cinema' ||
          activeScreen === 'o-layout-standing') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 8,
              borderTop: '1px solid var(--border)',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>
                Mẫu đang thiết kế:
              </span>
              {[
                { id: 'o-layout-stadium' as const, label: 'Sân vận động' },
                { id: 'o-layout-editor' as const, label: 'Nhà hát' },
                { id: 'o-layout-cinema' as const, label: 'Rạp phim' },
                { id: 'o-layout-standing' as const, label: 'Không có ghế' },
              ].map((tpl) => {
                const isTplActive = activeScreen === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => openLayoutEditor(tpl.id)}
                    style={{
                      border: isTplActive ? '1px solid var(--brand)' : '1px solid var(--border)',
                      background: isTplActive ? 'var(--brand)' : '#FFFFFF',
                      color: isTplActive ? '#FFFFFF' : 'var(--ink)',
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 999,
                      cursor: 'pointer',
                    }}
                  >
                    {tpl.label}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Mẹo: Nhấp vào từng ghế trên sơ đồ để chọn/bỏ chọn hoặc chỉnh số hàng/ghế ở cột phải.
            </span>
          </div>
        )}
      </div>

      {/* 1. o-venues: Địa điểm của Ánh Trăng Events */}
      {activeScreen === 'o-venues' && (
        <div>
          <div className="card" style={{ padding: '22px 24px', marginBottom: 18 }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15.5,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              Một tổ chức sử dụng nhiều địa điểm
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(state?.venues || []).map((v) => (
                <div
                  key={v.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '240px 1fr 140px auto',
                    alignItems: 'center',
                    gap: 20,
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ justifyContent: 'center', fontWeight: 700 }}
                    onClick={() => {
                      if (v.name.includes('Bến Sông')) {
                        setScreen('o-venue-bensong');
                      } else {
                        setNhName(v.name);
                        setScreen('o-venue-edit');
                      }
                    }}
                  >
                    {v.name}
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {v.city} · {v.type}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: v.status === 'VERIFIED' ? '#18794E' : '#C26B13',
                    }}
                  >
                    {v.status === 'VERIFIED' ? 'Đã xác minh' : 'Chờ xác minh'}
                  </span>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: 12, fontWeight: 600 }}
                      onClick={() => {
                        navigate(
                          `/org/events?screen=o-event-edit&venue=${encodeURIComponent(
                            v.name + (v.status === 'VERIFIED' ? ' (Đã xác minh)' : ''),
                          )}&createNew=true`,
                        );
                      }}
                    >
                      + Tạo sự kiện tại đây
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        if (v.type.includes('Không ghế') || v.type.includes('Ngoài trời')) {
                          openLayoutEditor('o-layout-standing');
                        } else {
                          openLayoutEditor('o-layout-editor');
                        }
                      }}
                    >
                      Mở sơ đồ ghế →
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#E11D48', padding: '6px 10px', fontSize: 12, fontWeight: 600 }}
                      title="Xóa địa điểm này"
                      onClick={() => {
                        if (window.confirm(`Bạn có chắc chắn muốn xóa địa điểm "${v.name}"?`)) {
                          deleteVenue(v.id);
                          showToast(`Đã xóa địa điểm "${v.name}" thành công!`, 'info');
                        }
                      }}
                    >
                      🗑️ Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minWidth: 190 }}
              onClick={() => setScreen('o-layouts')}
            >
              Tạo / chỉnh sửa sơ đồ
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minWidth: 160 }}
              onClick={() => setScreen('o-layout-history')}
            >
              Lịch sử sơ đồ
            </button>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minWidth: 160 }}
              onClick={() => setScreen('o-venue-create')}
            >
              Thêm địa điểm
            </button>
          </div>
        </div>
      )}

      {/* 2. o-venue-edit: Thông tin & xác minh địa điểm */}
      {activeScreen === 'o-venue-edit' && (
        <div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 18,
              alignItems: 'stretch',
              marginBottom: 16,
            }}
          >
            {/* Left card */}
            <div className="card" style={{ padding: 22 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 15.5,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Thông tin địa điểm
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Tên địa điểm</label>
                  <input
                    className="form-input"
                    value={nhName}
                    onChange={(e) => setNhName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Địa chỉ</label>
                  <input
                    className="form-input"
                    value={nhAddr}
                    onChange={(e) => setNhAddr(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Mô hình không gian</label>
                  <select
                    className="form-input"
                    value={nhSpaceModel}
                    onChange={(e) => setNhSpaceModel(e.target.value)}
                  >
                    <option value="Có ghế · Từng khu">Có ghế · Từng khu</option>
                    <option value="Sân vận động · Khán đài">Sân vận động · Khán đài</option>
                    <option value="Rạp phim · Phòng chiếu">Rạp phim · Phòng chiếu</option>
                    <option value="Không có ghế · Khu đứng">Không có ghế · Khu đứng</option>
                  </select>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '150px 1fr',
                    gap: 8,
                    fontSize: 13,
                    paddingTop: 6,
                  }}
                >
                  <span style={{ color: 'var(--muted)' }}>Sức chứa phát hành</span>
                  <strong>80 ghế</strong>
                  <span style={{ color: 'var(--muted)' }}>Tổ chức sử dụng</span>
                  <strong>Ánh Trăng Events</strong>
                </div>
              </div>
            </div>

            {/* Right card */}
            <div className="card" style={{ padding: 22 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 15.5,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Tài liệu xác minh địa điểm
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Quyền sở hữu / sử dụng địa điểm</label>
                  <div
                    onClick={() => setPreviewDoc(nhDoc1)}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <Upload size={16} color="var(--brand)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{nhDoc1}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        PDF, JPG, PNG · tối đa 10MB
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 600 }}>
                        Đã đính kèm
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="form-label">Giấy phép / PCCC (nếu áp dụng)</label>
                  <div
                    onClick={() => setPreviewDoc(nhDoc2)}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <Upload size={16} color="var(--brand)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{nhDoc2}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                        PDF, JPG, PNG · tối đa 10MB
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--brand)', fontWeight: 600 }}>
                        Đã đính kèm
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="form-label">Người liên hệ tại địa điểm</label>
                  <input
                    className="form-input"
                    value={nhContact}
                    onChange={(e) => setNhContact(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 24, paddingTop: 4 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Trạng thái hồ sơ</span>
                  <span className="badge badge-success">Đã xác minh</span>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              background: '#EDF3FF',
              border: '1px solid #C9DCFF',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1F4B99', marginBottom: 2 }}>
              Địa điểm đã xác minh riêng
            </div>
            <div style={{ fontSize: 12.5, color: '#3B62A6' }}>
              Sơ đồ ghế gắn với địa điểm này có thể phát hành và dùng cho sự kiện sau khi địa điểm được xác minh.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                submitVenueVerification('v-1', nhDoc1);
                showToast('Đã gửi hồ sơ bổ sung xác minh địa điểm.', 'success');
                setScreen('o-venue-pending');
              }}
            >
              Gửi hồ sơ bổ sung
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => showToast('Đã lưu nháp thông tin địa điểm.', 'info')}
            >
              Lưu nháp
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-layouts')}
            >
              Sơ đồ & phiên bản
            </button>
          </div>
        </div>
      )}

      {/* 3. o-venue-pending */}
      {activeScreen === 'o-venue-pending' && (
        <div
          className="card"
          style={{
            padding: '54px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: '#EAF7F0',
              color: '#18794E',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <CheckCircle2 size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Đã gửi hồ sơ xác minh địa điểm
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14, lineHeight: 1.5 }}>
            Admin sẽ kiểm tra giấy tờ pháp lý của {nhName}. Sơ đồ chỉ được phát hành khi địa điểm ở trạng thái Đã xác minh.
          </div>
          <span className="badge badge-warning" style={{ marginBottom: 18 }}>
            Chờ xác minh
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('o-venues')}>
            Quay lại địa điểm
          </button>
        </div>
      )}

      {/* 4. o-venue-bensong */}
      {activeScreen === 'o-venue-bensong' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Sân khấu Bến Sông
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên địa điểm</label>
                <input className="form-input" value={bsName} onChange={(e) => setBsName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Địa chỉ</label>
                <input className="form-input" value={bsAddr} onChange={(e) => setBsAddr(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Mô hình không gian</label>
                <input className="form-input" value={bsType} onChange={(e) => setBsType(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Giấy tờ pháp lý</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="form-input" value={bsDoc} onChange={(e) => setBsDoc(e.target.value)} />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPreviewDoc(bsDoc)}
                  >
                    Xem
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    submitVenueVerification('v-2', bsDoc);
                    showToast('Đã gửi hồ sơ Sân khấu Bến Sông chờ xác minh.', 'success');
                    setScreen('o-venue-bensong-pending');
                  }}
                >
                  Gửi xác minh
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-layout-standing')}
                >
                  Mở cấu hình khu đứng
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-venues')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 5. o-venue-bensong-pending */}
      {activeScreen === 'o-venue-bensong-pending' && (
        <div
          className="card"
          style={{
            padding: '54px 32px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: '#FDF4E7',
              color: '#C26B13',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Clock size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Hồ sơ địa điểm Sân khấu Bến Sông đang chờ duyệt
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14, lineHeight: 1.5 }}>
            Bạn đã có thể tạo bản nháp khu không có ghế, nhưng nút Phát hành sẽ mở sau khi Admin xác minh địa điểm.
          </div>
          <span className="badge badge-warning" style={{ marginBottom: 18 }}>
            Chờ xác minh
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-layout-standing')}
            >
              Mở sơ đồ nháp
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-venues')}
            >
              Quay lại danh sách
            </button>
          </div>
        </div>
      )}

      {/* 6. o-venue-create */}
      {activeScreen === 'o-venue-create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tên địa điểm</label>
                <input
                  className="form-input"
                  placeholder="Nhập tên nhà hát, sân vận động, rạp phim..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Thành phố</label>
                <input
                  className="form-input"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Địa chỉ chi tiết</label>
                <input
                  className="form-input"
                  placeholder="Số nhà, tên đường, quận/huyện..."
                  value={newAddr}
                  onChange={(e) => setNewAddr(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Loại hình không gian</label>
                <select
                  className="form-input"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                >
                  <option value="Nhà hát">Nhà hát</option>
                  <option value="Sân vận động">Sân vận động</option>
                  <option value="Rạp phim">Rạp phim</option>
                  <option value="Không có ghế">Không có ghế</option>
                </select>
              </div>
              <div>
                <label className="form-label">Tài liệu xác minh quyền sử dụng</label>
                <input
                  className="form-input"
                  value={newDoc}
                  onChange={(e) => setNewDoc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const createdName = newName.trim() || 'Địa điểm Biểu diễn Mới';
                    createVenue({
                      name: createdName,
                      city: newCity,
                      address: newAddr || 'Quận 1, TP.HCM',
                      type: newType,
                      documentName: newDoc,
                    });
                    showToast(`Đã thêm "${createdName}" và gửi hồ sơ xác minh.`, 'success');
                    setScreen('o-venues');
                  }}
                >
                  Lưu & gửi xác minh
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-venues')}
                >
                  Hủy
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 7. o-layouts: Sơ đồ địa điểm */}
      {activeScreen === 'o-layouts' && (
        <div>
          <FigmaHeroBanner variant="curtain" />

          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ position: 'relative', width: 280 }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)',
                  }}
                />
                <input
                  className="form-input"
                  style={{ paddingLeft: 34, height: 36 }}
                  placeholder="Tìm trong danh sách"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  background: '#EDF3FF',
                  color: '#1F4B99',
                  border: 'none',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Đã phát hành">Đã phát hành</option>
                <option value="Bản nháp">Bản nháp</option>
              </select>
            </div>

            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Sơ đồ</th>
                    <th>Phiên bản</th>
                    <th>Trạng thái</th>
                    <th style={{ textAlign: 'right' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {layoutRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => openLayoutEditor(row.target)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 8,
                              background: '#FDF0EC',
                              color: 'var(--brand)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <FileText size={14} />
                          </span>
                          <span style={{ fontWeight: 700 }}>{row.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{row.version}</td>
                      <td>
                        <span
                          className={
                            row.status === 'Đã phát hành'
                              ? 'badge badge-success'
                              : 'badge badge-warning'
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}
                          onClick={() => {
                            const vName = row.id === 'l-stadium' ? 'Nhà thi đấu Phú Thọ' : 'Nhà hát Ánh Trăng';
                            navigate(
                              `/org/events?screen=o-event-edit&venue=${encodeURIComponent(
                                vName,
                              )}&layout=${encodeURIComponent(row.name)}&createNew=true`,
                            );
                          }}
                        >
                          + Dùng cho sự kiện mới →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--muted)',
              }}
            >
              4 loại sơ đồ · Dữ liệu minh họa
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minWidth: 160 }}
              onClick={() => setScreen('o-layout-type')}
            >
              Tạo sơ đồ
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minWidth: 160 }}
              onClick={() => setScreen('o-layout-history')}
            >
              Lịch sử phiên bản
            </button>
          </div>
        </div>
      )}

      {/* 8. o-layout-type & 13. o-layout-change: Chọn loại hình địa điểm */}
      {(activeScreen === 'o-layout-type' || activeScreen === 'o-layout-change') && (
        <div className="card" style={{ padding: '26px 28px' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--ink)',
              marginBottom: 6,
            }}
          >
            Chọn mẫu sơ đồ theo địa điểm thực tế
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
            Bạn có thể chỉnh sửa khu vực, hàng ghế và lối đi sau khi chọn mẫu.
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 18,
              marginBottom: 20,
            }}
          >
            {/* Card 1: Sân vận động */}
            <div
              onClick={() => openLayoutEditor('o-layout-stadium')}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '22px 24px',
                background: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 130,
                  marginBottom: 14,
                }}
              >
                <StadiumTemplateIllustration />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Sân vận động
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
                  Khán đài, tầng và từng khu ghế.
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>
                  Chọn mẫu →
                </span>
              </div>
            </div>

            {/* Card 2: Nhà hát */}
            <div
              onClick={() => openLayoutEditor('o-layout-editor')}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '22px 24px',
                background: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 130,
                  marginBottom: 14,
                }}
              >
                <TheaterTemplateIllustration />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Nhà hát
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
                  Sân khấu, khu ghế và hàng ghế.
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>
                  Chọn mẫu →
                </span>
              </div>
            </div>

            {/* Card 3: Rạp phim */}
            <div
              onClick={() => openLayoutEditor('o-layout-cinema')}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '22px 24px',
                background: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 130,
                  marginBottom: 14,
                }}
              >
                <CinemaTemplateIllustration />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Rạp phim
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
                  Màn chiếu, phòng chiếu và lối đi.
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>
                  Chọn mẫu →
                </span>
              </div>
            </div>

            {/* Card 4: Không có ghế */}
            <div
              onClick={() => openLayoutEditor('o-layout-standing')}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 14,
                padding: '22px 24px',
                background: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: 130,
                  marginBottom: 14,
                }}
              >
                <StandingTemplateIllustration />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 16,
                    fontWeight: 700,
                    marginBottom: 4,
                  }}
                >
                  Không có ghế
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
                  Khu vực và sức chứa; không đánh số ghế.
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>
                  Chọn mẫu →
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minWidth: 160 }}
              onClick={() => setScreen('o-layouts')}
            >
              Quay lại danh sách
            </button>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              Loại hình giúp chọn mẫu; khu không ghế được quản lý bằng sức chứa.
            </span>
          </div>
        </div>
      )}

      {/* 9. o-layout-editor: Chỉnh sửa sơ đồ ghế (Nhà hát) */}
      {activeScreen === 'o-layout-editor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div>
            <div className="card" style={{ padding: 22, marginBottom: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700 }}>
                  Nhà hát Ánh Trăng / Sơ đồ nhà hát v4
                </div>
                <span className="badge badge-warning">Bản nháp</span>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => showToast('Đã thêm hàng ghế mới.', 'info')}
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => showToast('Phóng to sơ đồ.', 'info')}
                >
                  <ZoomIn size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => showToast('Thu nhỏ sơ đồ.', 'info')}
                >
                  <ZoomOut size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedTheaterSeats(['A05', 'A06'])}
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              <div
                style={{
                  background: '#172A35',
                  color: '#FFFFFF',
                  textAlign: 'center',
                  padding: '8px 0',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  maxWidth: 320,
                  margin: '0 auto 18px',
                }}
              >
                SÂN KHẤU
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                {THEATER_ROWS.map((row) => (
                  <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 18,
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--muted)',
                        textAlign: 'center',
                      }}
                    >
                      {row}
                    </span>
                    {THEATER_COLS.map((col) => {
                      const code = `${row}${String(col).padStart(2, '0')}`;
                      const isSelected = selectedTheaterSeats.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => toggleTheaterSeat(code)}
                          style={{
                            width: 27,
                            height: 25,
                            borderRadius: 5,
                            border: isSelected ? '1px solid #D34528' : '1px solid #E5DFD7',
                            background: isSelected ? '#D34528' : '#F6F3EE',
                            color: isSelected ? '#FFFFFF' : '#433D37',
                            fontSize: 10.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 8,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                  fontSize: 11.5,
                  color: 'var(--muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#E5DFD7' }} />
                  Còn trống
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#D34528' }} />
                  Đang chọn
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#172A35' }} />
                  Đã bán
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#D9822B' }} />
                  Đang giữ
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2452B5' }} />
                  Chặn bán
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#18794E' }} />
                  Org giữ
                </div>
              </div>
            </div>

            <FigmaInfoAlert tone="info">
              Bản nháp v4. Chỉ chỉnh sửa sơ đồ chưa phát hành.
            </FigmaInfoAlert>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minWidth: 180 }}
                onClick={() => setScreen('o-layout-publish')}
              >
                Kiểm tra & phát hành
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-layout-type')}
              >
                Đổi loại hình
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Thuộc tính
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="form-label">Tên khu</label>
                <input
                  className="form-input"
                  value={theaterZoneName}
                  onChange={(e) => setTheaterZoneName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Loại khu</label>
                <select
                  className="form-input"
                  value={theaterZoneType}
                  onChange={(e) => setTheaterZoneType(e.target.value)}
                >
                  <option value="Có ghế">Có ghế</option>
                  <option value="Khu đứng">Khu đứng</option>
                </select>
              </div>
              <div>
                <label className="form-label">Hàng × cột</label>
                <input
                  className="form-input"
                  value={theaterGridSpec}
                  onChange={(e) => setTheaterGridSpec(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Khoảng cách ghế</label>
                <input
                  className="form-input"
                  value={theaterSeatGap}
                  onChange={(e) => setTheaterSeatGap(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. o-layout-standing: Cấu hình khu không có ghế */}
      {activeScreen === 'o-layout-standing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div>
            <div className="card" style={{ padding: 22, marginBottom: 14 }}>
              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 16,
                }}
              >
                Thông tin chi tiết
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="form-label">Tên khu</label>
                  <input
                    className="form-input"
                    value={standingZoneName}
                    onChange={(e) => setStandingZoneName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Loại khu</label>
                  <select
                    className="form-input"
                    value={standingZoneType}
                    onChange={(e) => setStandingZoneType(e.target.value)}
                  >
                    <option value="Khu đứng">Khu đứng</option>
                    <option value="Khu tự do ngoài trời">Khu tự do ngoài trời</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Sức chứa</label>
                  <input
                    className="form-input"
                    value={standingCapacity}
                    onChange={(e) => setStandingCapacity(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <FigmaInfoAlert tone="info">
              Khu không có ghế vẫn có giới hạn sức chứa. Vé miễn phí cũng trừ số lượng.
            </FigmaInfoAlert>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minWidth: 180 }}
                onClick={() => setScreen('o-layout-publish')}
              >
                Kiểm tra & phát hành
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-layout-type')}
              >
                Đổi loại hình
              </button>
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Không có ghế
            </div>
            <div
              style={{
                background: '#172A35',
                height: 14,
                borderRadius: 5,
                marginBottom: 14,
              }}
            />
            <div
              style={{
                background: '#EAF5EF',
                border: '1.2px solid #4D9A73',
                borderRadius: 10,
                padding: '16px 18px',
                marginBottom: 14,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: '#146C3E', textTransform: 'uppercase' }}>
                {standingZoneName}
              </div>
              <div style={{ fontSize: 12.5, color: '#146C3E', marginTop: 4 }}>
                {standingCapacity} người
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Quản lý tổng sức chứa của từng khu; không tạo hàng hoặc số ghế.
            </div>
          </div>
        </div>
      )}

      {/* 11. o-layout-stadium: Sơ đồ sân vận động */}
      {activeScreen === 'o-layout-stadium' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div>
            <div className="card" style={{ padding: '22px 26px', marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                SVĐ Thành Phố / Khán đài
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
                Sân vận động · 4 khán đài · {stadiumTotalSeats} ghế
              </div>

              {/* Interactive Stadium Bowl SVG */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                <svg width="360" height="170" viewBox="0 0 360 170" fill="none">
                  {/* Stand D (top-left) */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setActiveStandCode('D');
                      setStadiumStandName('Khán đài D');
                    }}
                  >
                    <path
                      d="M42 66 C60 30, 108 18, 168 18 L162 44 C114 44, 80 52, 66 74 Z"
                      fill={activeStandCode === 'D' ? '#FBEAE5' : '#EBF0FA'}
                    />
                    <text
                      x="98"
                      y="38"
                      fill={activeStandCode === 'D' ? '#D34528' : '#2452B5'}
                      fontSize="11"
                      fontWeight="700"
                    >
                      D
                    </text>
                  </g>

                  {/* Stand A (top-right) */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setActiveStandCode('A');
                      setStadiumStandName('Khán đài A');
                    }}
                  >
                    <path
                      d="M192 18 C252 18, 300 30, 318 66 L294 74 C280 52, 246 44, 198 44 Z"
                      fill={activeStandCode === 'A' ? '#FBEAE5' : '#EBF0FA'}
                    />
                    <text
                      x="256"
                      y="38"
                      fill={activeStandCode === 'A' ? '#D34528' : '#2452B5'}
                      fontSize="11"
                      fontWeight="700"
                    >
                      A
                    </text>
                  </g>

                  {/* Stand C (bottom-left) */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setActiveStandCode('C');
                      setStadiumStandName('Khán đài C');
                    }}
                  >
                    <path
                      d="M66 96 C80 118, 114 126, 162 126 L168 152 C108 152, 60 140, 42 104 Z"
                      fill={activeStandCode === 'C' ? '#FBEAE5' : '#EBF0FA'}
                    />
                    <text
                      x="98"
                      y="138"
                      fill={activeStandCode === 'C' ? '#D34528' : '#2452B5'}
                      fontSize="11"
                      fontWeight="700"
                    >
                      C
                    </text>
                  </g>

                  {/* Stand B (bottom-right) */}
                  <g
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setActiveStandCode('B');
                      setStadiumStandName('Khán đài B');
                    }}
                  >
                    <path
                      d="M294 96 L318 104 C300 140, 252 152, 192 152 L198 126 C246 126, 280 118, 294 96 Z"
                      fill={activeStandCode === 'B' ? '#FBEAE5' : '#EBF0FA'}
                    />
                    <text
                      x="256"
                      y="138"
                      fill={activeStandCode === 'B' ? '#D34528' : '#2452B5'}
                      fontSize="11"
                      fontWeight="700"
                    >
                      B
                    </text>
                  </g>

                  {/* Center field */}
                  <rect
                    x="104"
                    y="52"
                    width="152"
                    height="66"
                    rx="6"
                    fill="#EAF5EF"
                    stroke="#4D9A73"
                    strokeWidth="1.2"
                  />
                  <line x1="180" y1="52" x2="180" y2="118" stroke="#4D9A73" strokeWidth="1" />
                  <circle cx="180" cy="85" r="13" fill="none" stroke="#4D9A73" strokeWidth="1" />
                  <rect
                    x="104"
                    y="67"
                    width="22"
                    height="36"
                    fill="none"
                    stroke="#4D9A73"
                    strokeWidth="1"
                  />
                  <rect
                    x="234"
                    y="67"
                    width="22"
                    height="36"
                    fill="none"
                    stroke="#4D9A73"
                    strokeWidth="1"
                  />
                  <text
                    x="180"
                    y="88"
                    textAnchor="middle"
                    fill="#146C3E"
                    fontSize="8.5"
                    fontWeight="800"
                  >
                    VÙNG TRUNG TÂM
                  </text>
                </svg>
              </div>

              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {stadiumStandName} · {stadiumFloor}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
                Mẫu {stadiumRowsCount} hàng × {stadiumColsCount} ghế. Thêm tầng hoặc khu để mở rộng sơ đồ.
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 18,
                }}
              >
                {ALPHABET.slice(0, Math.min(12, Math.max(1, stadiumRowsCount))).map((row) => {
                  const cols = Array.from(
                    { length: Math.min(16, Math.max(1, stadiumColsCount)) },
                    (_, i) => i + 1,
                  );
                  const aisleAfter = Math.floor(cols.length / 2);
                  return (
                    <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--muted)',
                        }}
                      >
                        {row}
                      </span>
                      {cols.map((col) => {
                        const code = `${activeStandCode}-${row}${col}`;
                        const isSelected = selectedStadiumSeats.includes(code);
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => toggleStadiumSeat(code)}
                            style={{
                              width: 26,
                              height: 24,
                              borderRadius: 5,
                              border: isSelected ? '1px solid #D34528' : '1px solid #EAE4DC',
                              background: isSelected ? '#D34528' : '#F6F3EE',
                              color: isSelected ? '#FFFFFF' : '#433D37',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                              marginRight: col === aisleAfter ? 16 : 0,
                            }}
                          >
                            {col}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Mỗi ghế có mã khu, hàng và số ghế riêng. Chừa lối đi theo bố trí thực tế.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minWidth: 170 }}
                onClick={() => setScreen('o-layout-publish')}
              >
                Kiểm tra & phát hành
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minWidth: 140 }}
                onClick={() => setScreen('o-layout-type')}
              >
                Đổi loại hình
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Sơ đồ mới ở trạng thái bản nháp. Phát hành sơ đồ trước khi dùng cho suất diễn.
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Thuộc tính sơ đồ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Loại hình địa điểm</label>
                <select
                  className="form-input"
                  value="Sân vận động"
                  onChange={(e) => handleLayoutTypeSelectChange(e.target.value)}
                >
                  <option value="Sân vận động">Sân vận động</option>
                  <option value="Nhà hát">Nhà hát</option>
                  <option value="Rạp phim">Rạp phim</option>
                  <option value="Không có ghế">Không có ghế</option>
                </select>
              </div>
              <div>
                <label className="form-label">Khán đài đang chỉnh sửa</label>
                <input
                  className="form-input"
                  value={stadiumStandName}
                  onChange={(e) => setStadiumStandName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Tầng</label>
                <select
                  className="form-input"
                  value={stadiumFloor}
                  onChange={(e) => setStadiumFloor(e.target.value)}
                >
                  <option value="Tầng 1">Tầng 1</option>
                  <option value="Tầng 2">Tầng 2</option>
                </select>
              </div>
              <div>
                <label className="form-label">Số hàng</label>
                <input
                  type="number"
                  className="form-input"
                  value={stadiumRowsCount}
                  onChange={(e) => setStadiumRowsCount(Number(e.target.value) || 6)}
                />
              </div>
              <div>
                <label className="form-label">Số ghế mỗi hàng</label>
                <input
                  type="number"
                  className="form-input"
                  value={stadiumColsCount}
                  onChange={(e) => setStadiumColsCount(Number(e.target.value) || 10)}
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Tổng mẫu: 4 khán đài × {stadiumPerStandSeats} ghế = {stadiumTotalSeats} ghế.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12. o-layout-cinema: Sơ đồ rạp phim */}
      {activeScreen === 'o-layout-cinema' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div>
            <div className="card" style={{ padding: '22px 26px', marginBottom: 16 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 16,
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                Rạp Tickey / {cinemaRoomName}
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14 }}>
                Rạp phim · {cinemaRowsCount} hàng × {cinemaColsCount} ghế · {cinemaTotalSeats} ghế
              </div>

              <div
                style={{
                  background: '#172A35',
                  color: '#FFFFFF',
                  textAlign: 'center',
                  padding: '10px 0',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  marginBottom: 20,
                }}
              >
                MÀN CHIẾU
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                {ALPHABET.slice(0, Math.min(12, Math.max(1, cinemaRowsCount))).map((row) => {
                  const cols = Array.from(
                    { length: Math.min(16, Math.max(1, cinemaColsCount)) },
                    (_, i) => i + 1,
                  );
                  const aisleAfter = Math.floor(cols.length / 2);
                  return (
                    <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 20,
                          fontSize: 11,
                          fontWeight: 700,
                          color: 'var(--muted)',
                        }}
                      >
                        {row}
                      </span>
                      {cols.map((col) => {
                        const code = `${row}${col}`;
                        const isSelected = selectedCinemaSeats.includes(code);
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => toggleCinemaSeat(code)}
                            style={{
                              width: 26,
                              height: 24,
                              borderRadius: 5,
                              border: isSelected ? '1px solid #D34528' : '1px solid #EAE4DC',
                              background: isSelected ? '#D34528' : '#F6F3EE',
                              color: isSelected ? '#FFFFFF' : '#433D37',
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: 'pointer',
                              marginRight: col === aisleAfter ? 18 : 0,
                            }}
                          >
                            {col}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Mỗi ghế có mã khu, hàng và số ghế riêng. Chừa lối đi theo bố trí thực tế.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minWidth: 170 }}
                onClick={() => setScreen('o-layout-publish')}
              >
                Kiểm tra & phát hành
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ minWidth: 140 }}
                onClick={() => setScreen('o-layout-type')}
              >
                Đổi loại hình
              </button>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Sơ đồ mới ở trạng thái bản nháp. Phát hành sơ đồ trước khi dùng cho suất diễn.
            </div>
          </div>

          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 14 }}>
              Thuộc tính sơ đồ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Loại hình địa điểm</label>
                <select
                  className="form-input"
                  value="Rạp phim"
                  onChange={(e) => handleLayoutTypeSelectChange(e.target.value)}
                >
                  <option value="Rạp phim">Rạp phim</option>
                  <option value="Sân vận động">Sân vận động</option>
                  <option value="Nhà hát">Nhà hát</option>
                  <option value="Không có ghế">Không có ghế</option>
                </select>
              </div>
              <div>
                <label className="form-label">Tên phòng</label>
                <input
                  className="form-input"
                  value={cinemaRoomName}
                  onChange={(e) => setCinemaRoomName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Số hàng</label>
                <input
                  type="number"
                  className="form-input"
                  value={cinemaRowsCount}
                  onChange={(e) => setCinemaRowsCount(Number(e.target.value) || 7)}
                />
              </div>
              <div>
                <label className="form-label">Số ghế mỗi hàng</label>
                <input
                  type="number"
                  className="form-input"
                  value={cinemaColsCount}
                  onChange={(e) => setCinemaColsCount(Number(e.target.value) || 12)}
                />
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Tổng mẫu: {cinemaRowsCount} hàng × {cinemaColsCount} ghế = {cinemaTotalSeats} ghế.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 14. o-layout-publish: Kiểm tra & phát hành sơ đồ */}
      {activeScreen === 'o-layout-publish' && (
        <div>
          <FigmaNavyContextBanner
            title={publishSummary.venueTitle}
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Bản nháp"
            image="/assets/f7ad36f342262321f71aa3b016819fcef14fcc90.jpg"
          />
          <FigmaContextGrid
            items={[
              { label: 'Tên sơ đồ', value: publishSummary.layoutName },
              { label: 'Loại hình', value: publishSummary.typeName },
              { label: 'Ghế / Sức chứa', value: publishSummary.capacityLabel },
              { label: 'Phiên bản', value: publishSummary.versionLabel },
            ]}
          />
          <FigmaInfoAlert tone="info">
            Kiểm tra mã khu, mã ghế và sức chứa trước khi phát hành. Phiên bản đã phát hành không được sửa trực tiếp.
          </FigmaInfoAlert>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                publishLayout('l-1');
                setPublishedTargets((prev) =>
                  prev.includes(currentEditorTarget) ? prev : [...prev, currentEditorTarget],
                );
                showToast(
                  `Đã phát hành sơ đồ "${publishSummary.layoutName}" (${publishSummary.capacityLabel}).`,
                  'success',
                );
                setScreen('o-layout-published');
              }}
            >
              Phát hành phiên bản
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen(currentEditorTarget)}
            >
              Quay lại chỉnh sửa
            </button>
          </div>
        </div>
      )}

      {/* 15. o-layout-published */}
      {activeScreen === 'o-layout-published' && (
        <div>
          <FigmaNavyContextBanner
            title={publishSummary.venueTitle}
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Đã phát hành"
            image="/assets/f7ad36f342262321f71aa3b016819fcef14fcc90.jpg"
          />
          <FigmaContextGrid
            items={[
              {
                label: 'Phiên bản',
                value: `${publishSummary.layoutName} (${publishSummary.versionLabel}) · ${publishSummary.capacityLabel}`,
              },
              { label: 'Trạng thái', value: 'Đã phát hành · Sẵn sàng gắn vào sự kiện' },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/org/events?screen=o-event-edit')}
            >
              Dùng cho sự kiện
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-layouts')}
            >
              Danh sách sơ đồ
            </button>
          </div>
        </div>
      )}

      {/* 16. o-layout-history: Lịch sử sơ đồ */}
      {activeScreen === 'o-layout-history' && (
        <div>
          <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 18 }}>
            <div
              style={{
                padding: '14px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ position: 'relative', width: 280 }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--muted)',
                  }}
                />
                <input
                  className="form-input"
                  style={{ paddingLeft: 34, height: 36 }}
                  placeholder="Tìm trong danh sách"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <span
                style={{
                  background: '#EDF3FF',
                  color: '#1F4B99',
                  borderRadius: 999,
                  padding: '6px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                Tất cả trạng thái
              </span>
            </div>

            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Phiên bản</th>
                    <th>Nội dung</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    onClick={() => setScreen('o-layout-published')}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: '#FDF0EC',
                            color: 'var(--brand)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FileText size={14} />
                        </span>
                        <span style={{ fontWeight: 700 }}>v4</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>80 ghế · 07/10/2026</td>
                    <td>
                      <span className="badge badge-success">Đã phát hành</span>
                    </td>
                  </tr>
                  <tr
                    onClick={() => setScreen('o-layout-published')}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: '#FDF0EC',
                            color: 'var(--brand)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <FileText size={14} />
                        </span>
                        <span style={{ fontWeight: 700 }}>v3</span>
                      </div>
                    </td>
                    <td style={{ color: 'var(--muted)' }}>80 ghế · 02/10/2026</td>
                    <td>
                      <span className="badge badge-success">Đã phát hành</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                fontSize: 12,
                color: 'var(--muted)',
              }}
            >
              2 bản ghi · Dữ liệu minh họa
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ minWidth: 170 }}
            onClick={() => setScreen('o-layout-editor')}
          >
            Tạo phiên bản mới
          </button>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc}
          organization="Ánh Trăng Events"
          status="Tài liệu pháp lý địa điểm"
        />
      )}
    </div>
  );
}
