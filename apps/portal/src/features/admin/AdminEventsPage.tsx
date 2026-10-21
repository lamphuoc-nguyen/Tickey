import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Search } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaDocumentRow,
  FigmaEventPreviewCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const ADMIN_EVENT_SCREENS: FigmaScreenOption[] = [
  { id: 'a-events', label: 'Kiểm duyệt sự kiện' },
  { id: 'a-event-review', label: 'Chi tiết duyệt · Đêm nhạc Mùa Thu' },
  { id: 'a-event-reject', label: 'Từ chối mở bán sự kiện' },
  { id: 'a-event-result', label: 'Đã phê duyệt mở bán sự kiện' },
  { id: 'a-cancellations', label: 'Yêu cầu hủy sự kiện' },
  { id: 'a-cancel-review', label: 'Xem xét hủy sự kiện · Đêm nhạc Mùa Thu' },
];

export function AdminEventsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, reviewAdminEvent } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-events';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const queueIdParam = searchParams.get('queueId');
  const eventsQueue = state?.adminEventsQueue || [];
  const firstPending = eventsQueue.find((e) => e.status === 'PENDING') || eventsQueue[0];
  const [selectedEventQueueId, setSelectedEventQueueId] = useState<string>(
    queueIdParam || firstPending?.id || 'ae-1',
  );

  const selectedEvent =
    eventsQueue.find((e) => e.id === (queueIdParam || selectedEventQueueId)) ||
    firstPending ||
    eventsQueue[0];

  const [rejectReason, setRejectReason] = useState(
    'Giấy phép biểu diễn của Sở Văn hóa chưa có trang phụ lục danh sách bài hát.',
  );

  const screenMeta =
    ADMIN_EVENT_SCREENS.find((s) => s.id === activeScreen) || ADMIN_EVENT_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_EVENT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-events */}
      {activeScreen === 'a-events' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ position: 'relative', width: 320 }}>
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
                  style={{ paddingLeft: 34 }}
                  placeholder="Tìm theo tên sự kiện, tổ chức..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('a-cancellations')}
              >
                Yêu cầu hủy sự kiện
              </button>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => showToast('Đã xuất danh sách kiểm duyệt sự kiện.', 'success')}
            >
              Xuất CSV
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                Tất cả danh sách sự kiện chờ kiểm duyệt
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {eventsQueue.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>SỰ KIỆN</th>
                    <th>TỔ CHỨC</th>
                    <th>ĐỊA ĐIỂM</th>
                    <th>SƠ ĐỒ GHẾ</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {eventsQueue.map((e) => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 700 }}>{e.eventName}</td>
                      <td>{e.orgName}</td>
                      <td>{e.venueName}</td>
                      <td>{e.layoutName}</td>
                      <td>
                        <span
                          className={`badge ${
                            e.status === 'APPROVED'
                              ? 'badge-success'
                              : e.status === 'REJECTED'
                                ? 'badge-danger'
                                : 'badge-warning'
                          }`}
                        >
                          {e.status === 'PENDING'
                            ? 'Chờ duyệt'
                            : e.status === 'APPROVED'
                              ? 'Đã duyệt'
                              : 'Từ chối'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEventQueueId(e.id);
                            setScreen('a-event-review');
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Kiểm duyệt →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. a-event-review */}
      {activeScreen === 'a-event-review' && (
        <div>
          <FigmaNavyContextBanner
            title={selectedEvent?.orgName || 'Tổ chức'}
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge={
              selectedEvent?.status === 'APPROVED'
                ? 'Đã duyệt mở bán'
                : selectedEvent?.status === 'REJECTED'
                  ? 'Đã từ chối'
                  : 'Đang kiểm duyệt'
            }
          />
          <FigmaContextGrid
            items={[
              {
                label: 'Sự kiện & Tổ chức',
                value: `${selectedEvent?.eventName || 'Sự kiện'} · ${selectedEvent?.orgName || 'Ánh Trăng Events'}`,
              },
              {
                label: 'Địa điểm & Pháp lý',
                value: `${selectedEvent?.venueName || 'Địa điểm'} · Đã kiểm tra địa điểm`,
              },
              {
                label: 'Sơ đồ & Định giá ghế',
                value: `${selectedEvent?.layoutName || 'Sơ đồ'} · Quota & Suất diễn hợp lệ`,
              },
              { label: 'Giấy phép biểu diễn', value: 'GPBD_SoVanHoa_2026.pdf · Hợp lệ' },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('GPBD_SoVanHoa_2026.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (selectedEvent) {
                  reviewAdminEvent(selectedEvent.id, true);
                  showToast(`Đã phê duyệt mở bán sự kiện "${selectedEvent.eventName}".`, 'success');
                  setScreen('a-event-result');
                }
              }}
            >
              Phê duyệt mở bán
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-event-reject')}
            >
              Từ chối hồ sơ
            </button>
          </div>
        </div>
      )}

      {/* 3. a-event-reject */}
      {activeScreen === 'a-event-reject' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Từ chối mở bán sự kiện
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Sự kiện</label>
                <input
                  className="form-input"
                  readOnly
                  value={`${selectedEvent?.eventName || 'Sự kiện'} · ${selectedEvent?.orgName || 'Tổ chức'}`}
                />
              </div>
              <div>
                <label className="form-label">Lý do từ chối / Yêu cầu chỉnh sửa</label>
                <input
                  className="form-input"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (selectedEvent) {
                      reviewAdminEvent(selectedEvent.id, false, rejectReason);
                      showToast(
                        `Đã từ chối mở bán sự kiện "${selectedEvent.eventName}" và thông báo cho Tổ chức.`,
                        'warning',
                      );
                      setScreen('a-events');
                    }
                  }}
                >
                  Xác nhận từ chối
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-event-review')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard />
        </div>
      )}

      {/* 4. a-event-result */}
      {activeScreen === 'a-event-result' && (
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
            Đã phê duyệt mở bán sự kiện
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14 }}>
            Sự kiện Đêm nhạc Mùa Thu đã chuyển sang trạng thái Đang mở bán (On Sale) theo lịch cấu hình của các suất diễn.
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            Approved · On Sale
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('a-events')}>
            Danh sách sự kiện
          </button>
        </div>
      )}

      {/* 5. a-cancellations */}
      {activeScreen === 'a-cancellations' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-events')}
            >
              ← Kiểm duyệt sự kiện
            </button>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}>
                Yêu cầu hủy sự kiện & hoàn tiền hàng loạt
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>1 bản ghi</div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ YÊU CẦU</th>
                    <th>SỰ KIỆN</th>
                    <th>TỔ CHỨC</th>
                    <th>VÉ BỊ ẢNH HƯỞNG</th>
                    <th>GIÁ TRỊ HOÀN</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700 }}>CAN-04</td>
                    <td>Đêm nhạc Mùa Thu</td>
                    <td>Ánh Trăng Events</td>
                    <td>214 vé</td>
                    <td>128.400.000đ</td>
                    <td>
                      <span className="badge badge-warning">Cần phê duyệt kép</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('a-cancel-review')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Xem xét →
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. a-cancel-review */}
      {activeScreen === 'a-cancel-review' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Yêu cầu hủy sự kiện"
          />
          <FigmaContextGrid
            items={[
              { label: 'Sự kiện & Tổ chức', value: 'Đêm nhạc Mùa Thu · Ánh Trăng Events' },
              { label: 'Quy mô hoàn tiền', value: '214 vé đã bán · Tổng hoàn 128.400.000đ' },
              { label: 'Lý do từ Tổ chức', value: 'Nghệ sĩ chính gặp sự cố sức khỏe đột xuất' },
              { label: 'Quy tắc phê duyệt', value: 'Dual Control · Cần 2 Admin xác nhận (Phiếu AP-015)' },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('ThongBaoHuyShow_BienBan_2026.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/admin/approvals?screen=a-approval-cancel')}
            >
              Chuyển sang Phiếu phê duyệt kép (AP-015)
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-cancellations')}
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc}
          organization="Ánh Trăng Events"
          status="Hồ sơ kiểm duyệt sự kiện"
        />
      )}
    </div>
  );
}
