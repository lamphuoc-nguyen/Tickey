import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  CheckCircle2,
  Clock,
  FileText,
  Percent,
  Plus,
  ShieldAlert,
  Tag,
  Ticket,
  Trash2,
  Users,
} from 'lucide-react';
import { DocumentPreviewModal, type DocumentPreviewItem } from '../../components/common/DocumentPreviewModal';

type EventStudioTab =
  | 'o-event-detail'
  | 'o-session-detail'
  | 'o-session-2'
  | 'o-session-paused'
  | 'o-ticket-free'
  | 'o-audience-pricing'
  | 'o-promotions'
  | 'o-seat-pricing'
  | 'o-seat-status'
  | 'o-review-submit'
  | 'o-event-pending'
  | 'o-cancel'
  | 'o-cancel-pending';

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const COLS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'];

interface FreeTicketTier {
  id: string;
  name: string;
  rule: string;
  maxQty: number;
  limitPerGuest: number;
  active: boolean;
}

interface AudienceGroup {
  id: string;
  name: string;
  discountPercent: number;
  condition: string;
  active: boolean;
}

interface PromoItem {
  id: string;
  type: 'EARLY_BIRD' | 'GROUP_BUNDLE';
  title: string;
  discountPercent: number;
  conditionText: string;
  quotaOrMinQty: number;
  active: boolean;
}

export function OrgEventFigmaStudio() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<EventStudioTab>('o-session-detail');
  const [banner, setBanner] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentPreviewItem | null>(null);

  // Event & Session live status
  const [eventReviewStatus, setEventReviewStatus] = useState<'PUBLISHED' | 'PENDING_REVIEW'>('PUBLISHED');
  const [session1Status, setSession1Status] = useState<'OPEN' | 'PAUSED_CANCEL_PENDING'>('OPEN');

  // 17:6163 | o-ticket-free states
  const [freeTiers, setFreeTiers] = useState<FreeTicketTier[]>([
    {
      id: 'FT-01',
      name: 'Vé tham dự miễn phí',
      rule: 'Miễn phí 0đ · Không qua cổng thanh toán',
      maxQty: 50,
      limitPerGuest: 2,
      active: true,
    },
  ]);
  const [freeTierName, setFreeTierName] = useState('Vé giao lưu Sinh viên Nhạc viện');
  const [freeTierRule, setFreeTierRule] = useState('Miễn phí 0đ · Phát QR ngay sau khi xác nhận');
  const [freeTierMaxQty, setFreeTierMaxQty] = useState(50);
  const [freeTierLimit, setFreeTierLimit] = useState(2);

  // 135:7709 | o-audience-pricing states
  const [audienceGroups, setAudienceGroups] = useState<AudienceGroup[]>([
    {
      id: 'AUD-01',
      name: 'Khán giả Tiêu chuẩn',
      discountPercent: 0,
      condition: 'Áp dụng cho mọi hạng ghế Standard & VIP',
      active: true,
    },
    {
      id: 'AUD-02',
      name: 'Học sinh / Sinh viên',
      discountPercent: 20,
      condition: 'Xuất trình thẻ HSSV khi soát vé cổng G1/G2',
      active: true,
    },
    {
      id: 'AUD-03',
      name: 'Người cao tuổi / Trẻ em',
      discountPercent: 30,
      condition: 'Áp dụng cho ghế hàng D–G',
      active: true,
    },
  ]);
  const [newAudName, setNewAudName] = useState('');
  const [newAudDiscount, setNewAudDiscount] = useState(15);
  const [newAudCondition, setNewAudCondition] = useState('Xuất trình thẻ hội viên tại cổng');

  // 135:7796 | o-promotions states
  const [promotions, setPromotions] = useState<PromoItem[]>([
    {
      id: 'PRM-01',
      type: 'EARLY_BIRD',
      title: 'Mở bán sớm trước 15/10/2026',
      discountPercent: 15,
      conditionText: 'Tự động áp dụng cho các vé đầu tiên của mỗi suất diễn',
      quotaOrMinQty: 30,
      active: true,
    },
    {
      id: 'PRM-02',
      type: 'GROUP_BUNDLE',
      title: 'Combo Nhóm 4 vé liền kề',
      discountPercent: 10,
      conditionText: 'Áp dụng khi khách chọn đủ số ghế tối thiểu trong cùng đơn',
      quotaOrMinQty: 4,
      active: true,
    },
  ]);
  const [newPromoTitle, setNewPromoTitle] = useState('');
  const [newPromoType, setNewPromoType] = useState<'EARLY_BIRD' | 'GROUP_BUNDLE'>('EARLY_BIRD');
  const [newPromoDiscount, setNewPromoDiscount] = useState(12);
  const [newPromoQuota, setNewPromoQuota] = useState(20);

  // Seat pricing states (1:8135 / 18:6892 / 136:7882)
  const [selectedRows, setSelectedRows] = useState<string[]>(['A', 'B', 'C']);
  const [selectedTierForPricing, setSelectedTierForPricing] = useState<'VIP' | 'Standard' | 'COMP'>('VIP');
  const [rowTierMap, setRowTierMap] = useState<Record<string, 'VIP' | 'Standard' | 'COMP'>>({
    A: 'VIP',
    B: 'VIP',
    C: 'VIP',
    D: 'Standard',
    E: 'Standard',
    F: 'Standard',
    G: 'Standard',
    H: 'COMP',
  });

  // Seat hold/block per session states (1:9796 / 17:8237 / 17:8375)
  const [selectedHoldSeats, setSelectedHoldSeats] = useState<string[]>(['B01', 'B02']);
  const [sessionSeatStates, setSessionSeatStates] = useState<Record<string, 'OPEN' | 'HOLD' | 'BLOCK'>>({
    A01: 'HOLD',
    A02: 'HOLD',
    B01: 'BLOCK',
    B02: 'BLOCK',
  });
  const [holdActionType, setHoldActionType] = useState<'HOLD' | 'BLOCK' | 'OPEN'>('BLOCK');
  const [holdReason, setHoldReason] = useState('Ghế khuất tầm nhìn do lắp bàn kỹ thuật âm thanh');
  const [seatConfirmStep, setSeatConfirmStep] = useState<'NONE' | 'BLOCK_CONFIRM' | 'RELEASE_CONFIRM'>('NONE');

  // Session cancel states (1:11116 / 1:11258)
  const [cancelTargetSession, setCancelTargetSession] = useState('Đêm 1 • 24/10/2026 (42 vé đã bán)');
  const [cancelReason, setCancelReason] = useState('Không thể tổ chức theo kế hoạch do điều kiện kỹ thuật sân khấu.');
  const [cancelRefundPolicy, setCancelRefundPolicy] = useState('Hoàn 100% cho vé đã thanh toán');

  const toggleRow = (r: string) => {
    setSelectedRows((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const toggleHoldSeat = (code: string) => {
    setSelectedHoldSeats((prev) => (prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code]));
  };

  const holdCount = Object.values(sessionSeatStates).filter((s) => s === 'HOLD').length;
  const blockCount = Object.values(sessionSeatStates).filter((s) => s === 'BLOCK').length;

  return (
    <div className="card" style={{ padding: '24px', marginTop: '8px' }}>
      <div style={{ marginBottom: '16px' }}>
        <span className="tag-overline">
          03 / ORGANIZATION · TRUNG TÂM VẬN HÀNH SUẤT DIỄN, GIÁ ĐỐI TƯỢNG, GÁN GHẾ & KIỂM DUYỆT FIGMA
        </span>
        <h2 style={{ fontSize: '22px', margin: '4px 0' }}>
          Chi tiết vận hành Đêm 1 & Đêm 2, Gán ghế hạng vé, Giữ/Chặn ghế theo suất & Yêu cầu hủy suất diễn
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
          Đầy đủ các màn hình chuyên sâu trong Figma: Chi tiết sự kiện (o-event-detail), Vận hành Đêm 1 (o-session-detail), Đêm 2 Bến Sông (o-session-2), Đêm 1 tạm dừng (o-session-paused), Vé miễn phí 0đ (o-ticket-free), Giá đối tượng (o-audience-pricing), Ưu đãi (o-promotions), Gán ghế hạng vé (o-seat-pricing), Giữ/Chặn ghế theo suất (o-seat-status), Gửi duyệt (o-review-submit) & Hủy suất diễn (o-cancel).
        </p>
      </div>

      {/* Sub-navigation pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
        {(
          [
            { id: 'o-event-detail', label: 'Chi tiết SK (o-event-detail)' },
            { id: 'o-session-detail', label: 'Vận hành Đêm 1 (o-session-detail)' },
            { id: 'o-session-2', label: 'Đêm 2 · Bến Sông (o-session-2)' },
            { id: 'o-session-paused', label: 'Đêm 1 · Tạm dừng (o-session-paused)' },
            { id: 'o-ticket-free', label: `Vé miễn phí 0đ (${freeTiers.length})` },
            { id: 'o-audience-pricing', label: `Giá đối tượng (${audienceGroups.length})` },
            { id: 'o-promotions', label: `Ưu đãi (${promotions.filter((p) => p.active).length})` },
            { id: 'o-seat-pricing', label: 'Gán ghế hạng vé (o-seat-pricing)' },
            { id: 'o-seat-status', label: `Giữ/Chặn ghế (${holdCount} giữ · ${blockCount} chặn)` },
            { id: 'o-review-submit', label: 'Kiểm tra gửi duyệt (o-review-submit)' },
            { id: 'o-event-pending', label: 'SK chờ duyệt v2 (o-event-pending)' },
            { id: 'o-cancel', label: 'Yêu cầu hủy suất (o-cancel)' },
            { id: 'o-cancel-pending', label: 'Chờ duyệt hủy CR-024 (o-cancel-pending)' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setBanner(null);
            }}
            className={`btn ${tab === item.id ? 'btn-primary' : 'btn-outline'}`}
            style={{ padding: '6px 11px', fontSize: '12px' }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {banner && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{banner}</span>
        </div>
      )}

      {/* 1:7376 | o-event-detail / Đêm nhạc Mùa Thu */}
      {tab === 'o-event-detail' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <span className="tag-overline">1:7376 · o-event-detail / Đêm nhạc Mùa Thu</span>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Đêm nhạc Mùa Thu · Hồ sơ đang xem</h3>
              <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                Đúng tổ chức và phạm vi xử lý
              </p>
            </div>
            <span className={`badge ${eventReviewStatus === 'PENDING_REVIEW' ? 'badge-warning' : 'badge-success'}`}>
              {eventReviewStatus === 'PENDING_REVIEW' ? 'Đang chờ Admin duyệt v2' : 'Đang mở bán'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Suất diễn</div>
              <div style={{ fontWeight: 700, marginTop: '4px' }}>
                Đêm 1 / 24/10 ({session1Status === 'PAUSED_CANCEL_PENDING' ? 'Tạm dừng · CR-024' : '19:30'}), Đêm 2 / 25/10 • 19:30
              </div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Hạng vé & Ưu đãi</div>
              <div style={{ fontWeight: 700, marginTop: '4px' }}>
                Standard • VIP • COMP + {freeTiers.length} hạng 0đ ({promotions.filter((p) => p.active).length} ưu đãi)
              </div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Địa điểm</div>
              <div style={{ fontWeight: 700, marginTop: '4px' }}>Đêm 1: Nhà hát Ánh Trăng · Đêm 2: Sân khấu Bến Sông</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button type="button" onClick={() => setTab('o-session-detail')} className="btn btn-primary">
              Quản lý suất diễn (Đêm 1)
            </button>
            <button type="button" onClick={() => setTab('o-review-submit')} className="btn btn-outline">
              Gửi duyệt công bố
            </button>
            <button
              type="button"
              onClick={() =>
                setPreviewDoc({
                  title: 'Hồ sơ pháp lý & Giấy phép Đêm nhạc Mùa Thu',
                  issuer: 'Ánh Trăng Events',
                  code: 'EVT-01',
                })
              }
              className="btn btn-outline"
            >
              <FileText size={15} /> Xem tài liệu
            </button>
          </div>
        </div>
      )}

      {/* 1:7658 | o-session-detail / Đêm 1 / Vận hành suất diễn */}
      {tab === 'o-session-detail' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <span className="tag-overline">1:7658 · o-session-detail / Đêm 1 / Vận hành suất diễn</span>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Đêm 1 / Vận hành suất diễn (Nhà hát Ánh Trăng)</h3>
            </div>
            <span className={`badge ${session1Status === 'PAUSED_CANCEL_PENDING' ? 'badge-warning' : 'badge-success'}`}>
              {session1Status === 'PAUSED_CANCEL_PENDING' ? 'Đã tạm dừng · Chờ duyệt hủy CR-024' : 'Đang mở bán'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Vé đã bán / Khả dụng</div>
              <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>
                42 / {80 - blockCount} ghế mở ({holdCount} giữ · {blockCount} chặn)
              </div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Check-in</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success)', marginTop: '2px' }}>38 lượt hợp lệ</div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Cổng hoạt động</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>G1 • G2</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button type="button" onClick={() => navigate('/org/staff')} className="btn btn-primary">
              Phân công nhân viên
            </button>
            <button type="button" onClick={() => navigate('/org/gates')} className="btn btn-outline">
              Cấu hình cổng & thiết bị
            </button>
            <button type="button" onClick={() => setTab('o-seat-status')} className="btn btn-outline">
              Giữ & chặn ghế theo suất
            </button>
            <button type="button" onClick={() => setTab('o-session-2')} className="btn btn-outline">
              Xem Đêm 2 · Bến Sông
            </button>
            <button type="button" onClick={() => setTab('o-cancel')} className="btn btn-outline" style={{ color: 'var(--danger)' }}>
              Yêu cầu hủy suất diễn
            </button>
          </div>
        </div>
      )}

      {/* 158:9645 | o-session-2 / Đêm 2 tại Bến Sông */}
      {tab === 'o-session-2' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span className="tag-overline">158:9645 · o-session-2 / Đêm 2 tại Bến Sông</span>
              <h3 style={{ margin: 0, fontSize: '20px' }}>Đêm 2 · 25/10/2026 tại Sân khấu Bến Sông</h3>
            </div>
            <span className="badge badge-info">Khu đứng General Admission</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            <div className="card">
              <div className="text-muted" style={{ fontSize: '12px' }}>Vé phát hành</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>22 / 300 vé GA</div>
            </div>
            <div className="card">
              <div className="text-muted" style={{ fontSize: '12px' }}>Địa điểm & Sơ đồ</div>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>Sân khấu Bến Sông · Layout v1</div>
            </div>
            <div className="card">
              <div className="text-muted" style={{ fontSize: '12px' }}>Cổng phụ trách</div>
              <div style={{ fontSize: '15px', fontWeight: 700 }}>Cổng G2 · Thiết bị G2-01</div>
            </div>
          </div>
          <button type="button" onClick={() => setTab('o-session-detail')} className="btn btn-outline">
            Quay về Đêm 1 · Nhà hát Ánh Trăng
          </button>
        </div>
      )}

      {/* 113:8978 | o-session-paused / Đêm 1 · Chờ xét duyệt hủy */}
      {tab === 'o-session-paused' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--warning-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--warning)' }}>
          <span className="tag-overline" style={{ color: 'var(--warning)' }}>113:8978 · o-session-paused</span>
          <h3 style={{ margin: '4px 0 8px', fontSize: '20px' }}>Đêm 1 · Chờ xét duyệt hủy (Bán vé đã tạm dừng)</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px' }}>
            Suất diễn Đêm 1 đang ở trạng thái khóa mở bán mới trong lúc chờ 2 Admin phê duyệt yêu cầu hủy CR-024 (Phiếu AP-024). Lý do: <strong>{cancelReason}</strong>
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => setTab('o-cancel-pending')} className="btn btn-primary">
              Xem hồ sơ yêu cầu hủy CR-024
            </button>
            <button
              type="button"
              onClick={() => {
                setSession1Status('OPEN');
                setTab('o-session-detail');
                setBanner('Đã rút yêu cầu hủy CR-024 và mở bán lại suất diễn Đêm 1!');
              }}
              className="btn btn-outline"
            >
              Rút yêu cầu hủy & Mở bán lại
            </button>
          </div>
        </div>
      )}

      {/* 17:6163 | o-ticket-free / Cấu hình vé miễn phí */}
      {tab === 'o-ticket-free' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <span className="tag-overline">17:6163 · o-ticket-free / Cấu hình vé miễn phí</span>
            <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>Cấu hình vé miễn phí (0đ)</h3>

            <table className="table" style={{ marginBottom: '18px', backgroundColor: 'var(--surface)' }}>
              <thead>
                <tr>
                  <th>Mã</th>
                  <th>Tên hạng vé 0đ</th>
                  <th>Số lượng tối đa</th>
                  <th>Giới hạn/khách</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {freeTiers.map((ft) => (
                  <tr key={ft.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{ft.id}</td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{ft.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{ft.rule}</div>
                    </td>
                    <td style={{ fontWeight: 700 }}>{ft.maxQty} vé</td>
                    <td>Tối đa {ft.limitPerGuest} vé</td>
                    <td>
                      <span className={`badge ${ft.active ? 'badge-success' : 'badge-warning'}`}>
                        {ft.active ? 'Đang mở đăng ký' : 'Tạm đóng'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setFreeTiers((prev) =>
                              prev.map((x) => (x.id === ft.id ? { ...x, active: !x.active } : x)),
                            );
                            setBanner(`Đã cập nhật trạng thái hạng vé miễn phí "${ft.name}".`);
                          }}
                          className="btn btn-outline"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                        >
                          {ft.active ? 'Tạm đóng' : 'Mở lại'}
                        </button>
                        {freeTiers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setFreeTiers((prev) => prev.filter((x) => x.id !== ft.id));
                              setBanner(`Đã xóa hạng vé miễn phí "${ft.name}".`);
                            }}
                            className="btn btn-outline"
                            style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Thêm / lưu hạng vé miễn phí 0đ mới</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
              <label>
                Tên hạng vé
                <input
                  type="text"
                  value={freeTierName}
                  onChange={(e) => setFreeTierName(e.target.value)}
                  placeholder="Nhập tên hạng vé 0đ"
                />
              </label>
              <label>
                Loại vé (0đ · Mở cổng ngay sau khi xác nhận)
                <input
                  type="text"
                  value={freeTierRule}
                  onChange={(e) => setFreeTierRule(e.target.value)}
                />
              </label>
              <label>
                Số lượng tối đa
                <input
                  type="number"
                  min={1}
                  value={freeTierMaxQty}
                  onChange={(e) => setFreeTierMaxQty(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
              <label>
                Giới hạn mỗi khách
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={freeTierLimit}
                  onChange={(e) => setFreeTierLimit(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!freeTierName.trim()) return;
                const nextId = `FT-0${freeTiers.length + 1}`;
                setFreeTiers((prev) => [
                  ...prev,
                  {
                    id: nextId,
                    name: freeTierName.trim(),
                    rule: freeTierRule.trim(),
                    maxQty: freeTierMaxQty,
                    limitPerGuest: freeTierLimit,
                    active: true,
                  },
                ]);
                setFreeTierName('');
                setBanner(`Đã thêm hạng vé miễn phí 0đ "${freeTierName.trim()}" (${freeTierMaxQty} vé)!`);
              }}
              className="btn btn-primary"
            >
              <Plus size={15} /> Lưu & Thêm vé miễn phí
            </button>
          </div>
          <div className="card" style={{ backgroundColor: 'var(--surface-alt)' }}>
            <Ticket size={24} color="var(--primary)" />
            <h4 style={{ margin: '10px 0 6px' }}>Quy tắc vé 0đ</h4>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
              Vé miễn phí không tạo giao dịch thanh toán; hệ thống phát hành mã QR ngay sau khi người tham dự xác nhận đăng ký. Tổng số lượng vé 0đ đang mở:{' '}
              <strong>
                {freeTiers.filter((x) => x.active).reduce((acc, x) => acc + x.maxQty, 0)} vé
              </strong>
              .
            </p>
          </div>
        </div>
      )}

      {/* 135:7709 | o-audience-pricing / Giá theo đối tượng */}
      {tab === 'o-audience-pricing' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">135:7709 · o-audience-pricing / Giá theo đối tượng</span>
          <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>Bảng giá theo nhóm đối tượng khán giả</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
            {audienceGroups.map((aud) => {
              const stdPrice = Math.round(350000 * (1 - aud.discountPercent / 100));
              const vipPrice = Math.round(650000 * (1 - aud.discountPercent / 100));
              return (
                <div key={aud.id} className="card" style={{ opacity: aud.active ? 1 : 0.6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {aud.discountPercent === 0 ? (
                      <Users size={18} color="var(--primary)" />
                    ) : (
                      <Percent size={18} color="var(--success)" />
                    )}
                    <span className={`badge ${aud.active ? 'badge-success' : 'badge-warning'}`}>
                      {aud.active ? 'Đang áp dụng' : 'Tạm tắt'}
                    </span>
                  </div>
                  <h4 style={{ margin: '8px 0 4px' }}>{aud.name}</h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' }}>
                    <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Mức giảm (%):</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={aud.discountPercent}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                        setAudienceGroups((prev) =>
                          prev.map((g) => (g.id === aud.id ? { ...g, discountPercent: val } : g)),
                        );
                      }}
                      style={{ maxWidth: '80px', padding: '4px 8px' }}
                    />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>
                    Standard: {stdPrice.toLocaleString('vi-VN')}đ • VIP: {vipPrice.toLocaleString('vi-VN')}đ
                  </div>
                  <p className="text-muted" style={{ fontSize: '12px', margin: '4px 0 10px' }}>{aud.condition}</p>
                  <button
                    type="button"
                    onClick={() =>
                      setAudienceGroups((prev) =>
                        prev.map((g) => (g.id === aud.id ? { ...g, active: !g.active } : g)),
                      )
                    }
                    className="btn btn-outline"
                    style={{ padding: '4px 10px', fontSize: '11px', width: '100%' }}
                  >
                    {aud.active ? 'Tạm ngưng nhóm này' : 'Kích hoạt lại'}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding: '16px', marginBottom: '14px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>Thêm nhóm đối tượng ưu đãi mới</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr auto', gap: '10px', alignItems: 'end' }}>
              <label>
                Tên nhóm đối tượng
                <input
                  type="text"
                  value={newAudName}
                  onChange={(e) => setNewAudName(e.target.value)}
                  placeholder="VD: Cựu chiến binh / Hội viên"
                />
              </label>
              <label>
                Giảm giá (%)
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newAudDiscount}
                  onChange={(e) => setNewAudDiscount(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
                />
              </label>
              <label>
                Điều kiện soát vé
                <input
                  type="text"
                  value={newAudCondition}
                  onChange={(e) => setNewAudCondition(e.target.value)}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!newAudName.trim()) return;
                  setAudienceGroups((prev) => [
                    ...prev,
                    {
                      id: `AUD-0${prev.length + 1}`,
                      name: newAudName.trim(),
                      discountPercent: newAudDiscount,
                      condition: newAudCondition.trim(),
                      active: true,
                    },
                  ]);
                  setNewAudName('');
                  setBanner(`Đã thêm nhóm đối tượng "${newAudName.trim()}" giảm ${newAudDiscount}%!`);
                }}
                className="btn btn-primary"
              >
                <Plus size={15} /> Thêm đối tượng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 135:7796 | o-promotions / Ưu đãi theo thời gian và mua nhóm */}
      {tab === 'o-promotions' && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <span className="tag-overline">135:7796 · o-promotions / Ưu đãi theo thời gian và mua nhóm</span>
          <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>Cấu hình Early Bird & Combo Mua nhóm</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '18px' }}>
            {promotions.map((prm) => (
              <div key={prm.id} className="card" style={{ opacity: prm.active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className={`badge ${prm.type === 'EARLY_BIRD' ? 'badge-success' : 'badge-info'}`}>
                    {prm.type === 'EARLY_BIRD' ? 'Ưu đãi theo thời gian (Early Bird)' : 'Ưu đãi mua nhóm (Group Bundle)'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPromotions((prev) =>
                        prev.map((p) => (p.id === prm.id ? { ...p, active: !p.active } : p)),
                      )
                    }
                    className="btn btn-outline"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                  >
                    {prm.active ? 'Đang bật (Tắt)' : 'Đang tắt (Bật)'}
                  </button>
                </div>
                <h4 style={{ margin: '0 0 6px' }}>
                  {prm.title} · Giảm {prm.discountPercent}%
                </h4>
                <p className="text-muted" style={{ fontSize: '13px', margin: '0 0 10px' }}>
                  {prm.conditionText} (Định mức/Tối thiểu: <strong>{prm.quotaOrMinQty} vé</strong>)
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ fontSize: '12px' }}>
                    Mức giảm (%)
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={prm.discountPercent}
                      onChange={(e) => {
                        const val = Math.min(90, Math.max(1, Number(e.target.value) || 1));
                        setPromotions((prev) =>
                          prev.map((p) => (p.id === prm.id ? { ...p, discountPercent: val } : p)),
                        );
                      }}
                    />
                  </label>
                  <label style={{ fontSize: '12px' }}>
                    {prm.type === 'EARLY_BIRD' ? 'Số vé tối đa' : 'Số vé tối thiểu/đơn'}
                    <input
                      type="number"
                      min={1}
                      value={prm.quotaOrMinQty}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setPromotions((prev) =>
                          prev.map((p) => (p.id === prm.id ? { ...p, quotaOrMinQty: val } : p)),
                        );
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h4 style={{ margin: '0 0 10px', fontSize: '15px' }}>Tạo chiến dịch ưu đãi mới</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 110px 130px auto', gap: '10px', alignItems: 'end' }}>
              <label>
                Tên chương trình
                <input
                  type="text"
                  value={newPromoTitle}
                  onChange={(e) => setNewPromoTitle(e.target.value)}
                  placeholder="VD: Combo Cặp đôi Mùa Thu"
                />
              </label>
              <label>
                Loại ưu đãi
                <select
                  value={newPromoType}
                  onChange={(e) => setNewPromoType(e.target.value as 'EARLY_BIRD' | 'GROUP_BUNDLE')}
                >
                  <option value="EARLY_BIRD">Early Bird (Theo thời gian)</option>
                  <option value="GROUP_BUNDLE">Mua nhóm (Group Bundle)</option>
                </select>
              </label>
              <label>
                Giảm (%)
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={newPromoDiscount}
                  onChange={(e) => setNewPromoDiscount(Number(e.target.value) || 10)}
                />
              </label>
              <label>
                Số lượng vé
                <input
                  type="number"
                  min={2}
                  value={newPromoQuota}
                  onChange={(e) => setNewPromoQuota(Number(e.target.value) || 2)}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  if (!newPromoTitle.trim()) return;
                  setPromotions((prev) => [
                    ...prev,
                    {
                      id: `PRM-0${prev.length + 1}`,
                      type: newPromoType,
                      title: newPromoTitle.trim(),
                      discountPercent: newPromoDiscount,
                      conditionText:
                        newPromoType === 'EARLY_BIRD'
                          ? 'Áp dụng tự động cho các vé đặt sớm'
                          : 'Áp dụng tự động khi giỏ hàng đạt số vé tối thiểu',
                      quotaOrMinQty: newPromoQuota,
                      active: true,
                    },
                  ]);
                  setNewPromoTitle('');
                  setBanner(`Đã thêm chương trình ưu đãi "${newPromoTitle.trim()}" (-${newPromoDiscount}%)!`);
                }}
                className="btn btn-primary"
              >
                <Tag size={15} /> Thêm ưu đãi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1:8135 | o-seat-pricing, 18:6892 | o-seat-pricing-vip, 136:7882 | o-seat-rows-applied */}
      {tab === 'o-seat-pricing' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <span className="tag-overline">
              1:8135 · o-seat-pricing • 18:6892 · o-seat-pricing-vip • 136:7882 · o-seat-rows-applied
            </span>
            <h3 style={{ margin: '4px 0 12px', fontSize: '18px' }}>
              Gán ghế cho hạng vé · Sơ đồ Đêm 1 / Nhà hát Ánh Trăng
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ROWS.map((r) => {
                const isRowSelected = selectedRows.includes(r);
                const tier = rowTierMap[r] || 'Standard';
                return (
                  <div
                    key={r}
                    onClick={() => toggleRow(r)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '84px repeat(10, 1fr)',
                      gap: '6px',
                      alignItems: 'center',
                      padding: '6px 8px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      border: isRowSelected ? '2px solid var(--navy)' : '1px solid transparent',
                      backgroundColor: isRowSelected ? 'rgba(23,42,53,0.05)' : 'transparent',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 700 }}>
                      Hàng {r} ({tier})
                    </div>
                    {COLS.map((c) => (
                      <div
                        key={`${r}${c}`}
                        style={{
                          padding: '5px 2px',
                          textAlign: 'center',
                          borderRadius: '5px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor:
                            tier === 'VIP'
                              ? 'var(--primary-tint)'
                              : tier === 'COMP'
                              ? 'var(--warning-bg)'
                              : 'var(--info-bg)',
                          color:
                            tier === 'VIP'
                              ? 'var(--primary)'
                              : tier === 'COMP'
                              ? 'var(--warning)'
                              : 'var(--info)',
                        }}
                      >
                        {r}{c}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ padding: '20px', backgroundColor: 'var(--surface-alt)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '17px' }}>Chọn hàng ghế và áp dụng hạng vé</h4>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Dãy đang chọn: <strong>{selectedRows.length > 0 ? `Hàng ${selectedRows.join(', ')}` : 'Chưa chọn'}</strong>
              </div>

              <label>
                Hạng vé áp dụng
                <select
                  value={selectedTierForPricing}
                  onChange={(e) => setSelectedTierForPricing(e.target.value as 'VIP' | 'Standard' | 'COMP')}
                >
                  <option value="VIP">VIP · 650.000đ</option>
                  <option value="Standard">Standard · 350.000đ</option>
                  <option value="COMP">COMP · 0đ (Khách mời)</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  const next = { ...rowTierMap };
                  selectedRows.forEach((r) => {
                    next[r] = selectedTierForPricing;
                  });
                  setRowTierMap(next);
                  setBanner(`Đã áp dụng hạng vé ${selectedTierForPricing} cho Hàng ${selectedRows.join(', ')} (o-seat-rows-applied)!`);
                }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Áp dụng cho dãy đã chọn
              </button>
              <button
                type="button"
                onClick={() => setTab('o-review-submit')}
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Lưu và tiếp tục gửi duyệt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1:9796 | o-seat-status, 17:8237 | o-seat-block-confirm, 17:8375 | o-seat-release-confirm */}
      {tab === 'o-seat-status' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
          <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
            <span className="tag-overline">
              1:9796 · o-seat-status • 17:8237 · o-seat-block-confirm • 17:8375 · o-seat-release-confirm
            </span>
            <h3 style={{ margin: '4px 0 12px', fontSize: '18px' }}>
              Giữ và chặn ghế theo suất · Đêm 1 / Nhà hát Ánh Trăng
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ROWS.map((r) => (
                <div key={r} style={{ display: 'grid', gridTemplateColumns: '28px repeat(10, 1fr)', gap: '6px', alignItems: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>{r}</div>
                  {COLS.map((c) => {
                    const code = `${r}${c}`;
                    const st = sessionSeatStates[code] || 'OPEN';
                    const isSel = selectedHoldSeats.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleHoldSeat(code)}
                        style={{
                          padding: '6px 2px',
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
                              : '#FFFFFF',
                          color:
                            st === 'BLOCK'
                              ? 'var(--danger)'
                              : st === 'HOLD'
                              ? 'var(--warning)'
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

          <div style={{ padding: '20px', backgroundColor: 'var(--surface-alt)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h4 style={{ margin: 0, fontSize: '17px' }}>Thao tác ghế trong suất</h4>
              <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                Ghế đang chọn: <strong>{selectedHoldSeats.join(', ') || 'Chưa chọn'}</strong>
              </div>

              <label>
                Trạng thái áp dụng
                <select
                  value={holdActionType}
                  onChange={(e) => setHoldActionType(e.target.value as 'HOLD' | 'BLOCK' | 'OPEN')}
                >
                  <option value="HOLD">Giữ ghế (Khách mời / Nội bộ)</option>
                  <option value="BLOCK">Chặn ghế (Kỹ thuật / Không mở bán)</option>
                  <option value="OPEN">Mở lại ghế (Đưa về mở bán)</option>
                </select>
              </label>

              <label>
                Lý do ghi nhận
                <textarea rows={2} value={holdReason} onChange={(e) => setHoldReason(e.target.value)} />
              </label>

              {seatConfirmStep !== 'NONE' && (
                <div style={{ padding: '12px', borderRadius: 'var(--radius-md)', backgroundColor: seatConfirmStep === 'BLOCK_CONFIRM' ? 'var(--danger-bg)' : 'var(--info-bg)', color: seatConfirmStep === 'BLOCK_CONFIRM' ? 'var(--danger)' : 'var(--info)', fontSize: '12px', fontWeight: 600 }}>
                  {seatConfirmStep === 'BLOCK_CONFIRM'
                    ? `Xác nhận chặn ghế (17:8237): Chặn bán các ghế ${selectedHoldSeats.join(', ')} cho suất Đêm 1?`
                    : `Xác nhận mở lại ghế (17:8375): Mở bán trở lại các ghế ${selectedHoldSeats.join(', ')}?`}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...sessionSeatStates };
                        const targetState = seatConfirmStep === 'BLOCK_CONFIRM' ? 'BLOCK' : 'OPEN';
                        selectedHoldSeats.forEach((s) => {
                          next[s] = targetState;
                        });
                        setSessionSeatStates(next);
                        setSeatConfirmStep('NONE');
                        setBanner(`Đã cập nhật trạng thái ghế ${selectedHoldSeats.join(', ')} thành ${targetState}!`);
                      }}
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Xác nhận thực hiện
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeatConfirmStep('NONE')}
                      className="btn btn-outline"
                      style={{ padding: '6px 12px', fontSize: '12px' }}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  const next = { ...sessionSeatStates };
                  selectedHoldSeats.forEach((s) => {
                    next[s] = 'HOLD';
                  });
                  setSessionSeatStates(next);
                  setBanner(`Đã giữ nội bộ ghế ${selectedHoldSeats.join(', ')}.`);
                }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                Giữ ghế
              </button>
              <button
                type="button"
                onClick={() => setSeatConfirmStep('BLOCK_CONFIRM')}
                className="btn btn-outline"
                style={{ width: '100%', color: 'var(--danger)' }}
              >
                Chặn ghế (o-seat-block-confirm)
              </button>
              <button
                type="button"
                onClick={() => setSeatConfirmStep('RELEASE_CONFIRM')}
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Mở lại ghế (o-seat-release-confirm)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1:8483 | o-review-submit & 1:8616 | o-event-pending */}
      {(tab === 'o-review-submit' || tab === 'o-event-pending') && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <span className="tag-overline">
                {tab === 'o-review-submit'
                  ? '1:8483 · o-review-submit / Kiểm tra trước khi gửi duyệt'
                  : '1:8616 · o-event-pending / Sự kiện đang chờ duyệt'}
              </span>
              <h3 style={{ margin: 0, fontSize: '20px' }}>
                {tab === 'o-review-submit' ? 'Kiểm tra trước khi gửi duyệt' : 'Sự kiện đang chờ duyệt (Thay đổi v2)'}
              </h3>
            </div>
            <span className={`badge ${tab === 'o-review-submit' ? 'badge-info' : 'badge-warning'}`}>
              <Clock size={14} /> {tab === 'o-review-submit' ? 'Sẵn sàng gửi duyệt' : 'Đang xem xét'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '18px' }}>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Hồ sơ tổ chức</div>
              <div style={{ fontWeight: 700 }}>Đã xác minh KYC</div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Địa điểm & sơ đồ</div>
              <div style={{ fontWeight: 700 }}>Đã chọn sơ đồ đã phát hành (Layout v4)</div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Suất diễn & hạng vé</div>
              <div style={{ fontWeight: 700 }}>2 suất • {3 + freeTiers.length} hạng vé</div>
            </div>
            <div className="card" style={{ padding: '14px 16px' }}>
              <div className="text-muted" style={{ fontSize: '12px' }}>Chính sách hoàn tiền</div>
              <div style={{ fontWeight: 700 }}>Theo quy định sự kiện</div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() =>
                setPreviewDoc({
                  title: 'Hồ sơ kiểm duyệt sự kiện · Đêm nhạc Mùa Thu',
                  issuer: 'Ánh Trăng Events',
                  code: 'EV-091',
                })
              }
              className="btn btn-outline"
            >
              Xem tài liệu
            </button>
            {tab === 'o-review-submit' ? (
              <button
                type="button"
                onClick={() => {
                  setEventReviewStatus('PENDING_REVIEW');
                  setTab('o-event-pending');
                  setBanner('Đã gửi hồ sơ sự kiện lên Platform Admin kiểm duyệt!');
                }}
                className="btn btn-primary"
              >
                Gửi Admin kiểm duyệt
              </button>
            ) : (
              <button type="button" onClick={() => setTab('o-event-detail')} className="btn btn-primary">
                Về chi tiết sự kiện
              </button>
            )}
          </div>
        </div>
      )}

      {/* 1:11116 | o-cancel & 1:11258 | o-cancel-pending */}
      {(tab === 'o-cancel' || tab === 'o-cancel-pending') && (
        <div style={{ padding: '20px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
          {tab === 'o-cancel' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
              <div>
                <span className="tag-overline" style={{ color: 'var(--danger)' }}>
                  1:11116 · o-cancel / Yêu cầu hủy suất diễn
                </span>
                <h3 style={{ margin: '4px 0 14px', fontSize: '20px' }}>Yêu cầu hủy suất diễn · Đêm 1 (24/10/2026)</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <label>
                    Suất diễn
                    <select
                      value={cancelTargetSession}
                      onChange={(e) => setCancelTargetSession(e.target.value)}
                    >
                      <option value="Đêm 1 • 24/10/2026 (42 vé đã bán)">Đêm 1 • 24/10/2026 (42 vé đã bán)</option>
                      <option value="Đêm 2 • 25/10/2026 (22 vé đã bán)">Đêm 2 • 25/10/2026 (22 vé đã bán)</option>
                    </select>
                  </label>
                  <label>
                    Lý do hủy
                    <textarea rows={3} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                  </label>
                  <label>
                    Phương án hoàn tiền
                    <select
                      value={cancelRefundPolicy}
                      onChange={(e) => setCancelRefundPolicy(e.target.value)}
                    >
                      <option value="Hoàn 100% cho vé đã thanh toán">Hoàn 100% cho vé đã thanh toán</option>
                      <option value="Hoàn 100% + Tặng voucher 20% suất diễn tiếp theo">Hoàn 100% + Tặng voucher 20% suất diễn tiếp theo</option>
                    </select>
                  </label>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSession1Status('PAUSED_CANCEL_PENDING');
                        setTab('o-cancel-pending');
                        setBanner(`Đã gửi yêu cầu hủy suất diễn CR-024 cho "${cancelTargetSession}". Bán vé đã tạm dừng.`);
                      }}
                      className="btn btn-primary"
                      style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
                    >
                      Gửi yêu cầu hủy
                    </button>
                    <button type="button" onClick={() => setTab('o-session-detail')} className="btn btn-outline">
                      Quay lại suất diễn
                    </button>
                  </div>
                </div>
              </div>
              <div className="card" style={{ backgroundColor: 'var(--surface-alt)' }}>
                <ShieldAlert size={22} color="var(--danger)" />
                <h4 style={{ margin: '10px 0 6px' }}>Quy định hủy suất diễn</h4>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)' }}>
                  Hủy suất diễn cần Admin phê duyệt theo quy định Two-Man Rule (Phiếu AP-024). Ngay khi gửi yêu cầu, hệ thống tạm dừng bán vé mới.
                </p>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <span className="tag-overline">1:11258 · o-cancel-pending / Đã gửi yêu cầu hủy</span>
                  <h3 style={{ margin: 0, fontSize: '20px' }}>Đã gửi yêu cầu hủy · CR-024 ({cancelTargetSession})</h3>
                </div>
                <span className="badge badge-warning">Đang xem xét (1/2 phiếu Admin)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
                <div className="card" style={{ padding: '14px' }}>
                  <div className="text-muted" style={{ fontSize: '12px' }}>Trạng thái</div>
                  <div style={{ fontWeight: 700 }}>Bán vé đã tạm dừng</div>
                </div>
                <div className="card" style={{ padding: '14px' }}>
                  <div className="text-muted" style={{ fontSize: '12px' }}>Phương án hoàn</div>
                  <div style={{ fontWeight: 700 }}>{cancelRefundPolicy}</div>
                </div>
                <div className="card" style={{ padding: '14px' }}>
                  <div className="text-muted" style={{ fontSize: '12px' }}>Phê duyệt</div>
                  <div style={{ fontWeight: 700 }}>Cần hai Admin phê duyệt (AP-024)</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" onClick={() => setTab('o-session-paused')} className="btn btn-primary">
                  Quay lại suất diễn (Trạng thái tạm dừng)
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin/approvals')}
                  className="btn btn-outline"
                >
                  Mở trang Admin Phê duyệt 2 lớp (AP-024)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <DocumentPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
