import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CheckCircle2, Inbox, AlertOctagon, ShieldAlert, Loader2, Search } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import { DocumentPreviewModal } from '../../components/common/DocumentPreviewModal';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaDocumentRow,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const REPORT_SCREENS: FigmaScreenOption[] = [
  { id: 'o-disputes', label: 'Phản ánh & tranh chấp' },
  { id: 'o-dispute-response', label: 'Phản hồi tranh chấp · DP-09' },
  { id: 'o-refunds', label: 'Yêu cầu hoàn tiền' },
  { id: 'o-refund-review', label: 'Xem xét hoàn tiền · RF-024' },
  { id: 'o-refund-outcome', label: 'Đã xử lý yêu cầu hoàn tiền' },
  { id: 'o-refund-policy', label: 'Chính sách hoàn vé sự kiện' },
  { id: 'o-empty', label: 'Trạng thái rỗng (Empty State)' },
  { id: 'o-error', label: 'Trạng thái lỗi kết nối (Error State)' },
  { id: 'o-forbidden', label: 'Không đủ quyền truy cập (403)' },
  { id: 'o-loading', label: 'Đang đồng bộ dữ liệu (Loading)' },
];

export function OrgReportsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, respondDispute, reviewOrgRefund } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-disputes';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const [disputeReply, setDisputeReply] = useState(
    'Khách đến cổng G1 lúc 20:14 nhưng xuất trình mã QR của Suất Đêm 2 (25/10). Đã hỗ trợ đổi vé tại quầy.',
  );
  const [disputeEvidence, setDisputeEvidence] = useState('LogQuetVe_CongG1_DP09.pdf');

  const [policyRule, setPolicyRule] = useState('Cho phép hoàn 80% trước 72 giờ mở màn; không hoàn trong vòng 72 giờ.');

  const screenMeta = REPORT_SCREENS.find((s) => s.id === activeScreen) || REPORT_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={REPORT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. o-disputes */}
      {activeScreen === 'o-disputes' && (
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
                  placeholder="Tìm theo mã phản ánh, đơn vé..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-refunds')}
              >
                Yêu cầu hoàn tiền
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-refund-policy')}
              >
                Chính sách hoàn vé
              </button>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => showToast('Đã xuất danh sách phản ánh ra CSV.', 'success')}
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
                Tất cả danh sách phản ánh
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.disputes.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ HS</th>
                    <th>ĐƠN VÉ</th>
                    <th>CHỦ ĐỀ PHẢN ÁNH</th>
                    <th>HẠN PHẢN HỒI</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.disputes.map((d) => (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 700 }}>{d.code}</td>
                      <td>{d.orderCode}</td>
                      <td>{d.topic}</td>
                      <td>{d.sla}</td>
                      <td>
                        <span
                          className={`badge ${
                            d.status === 'RESOLVED' || d.status === 'RESPONDED'
                              ? 'badge-success'
                              : 'badge-warning'
                          }`}
                        >
                          {d.status === 'OPEN'
                            ? 'Cần giải trình'
                            : d.status === 'RESPONDED'
                              ? 'Đã gửi giải trình'
                              : 'Đã đóng'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setScreen('o-dispute-response')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Giải trình →
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

      {/* 2. o-dispute-response */}
      {activeScreen === 'o-dispute-response' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Phản hồi hồ sơ DP-09
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Mã hồ sơ & Đơn vé liên quan</label>
                <input
                  className="form-input"
                  readOnly
                  value="DP-09 · Đơn TK-1024 (Khách báo lỗi quét QR tại Cổng G1)"
                />
              </div>
              <div>
                <label className="form-label">Nội dung giải trình từ Tổ chức</label>
                <input
                  className="form-input"
                  value={disputeReply}
                  onChange={(e) => setDisputeReply(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Bằng chứng log soát vé đính kèm</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    value={disputeEvidence}
                    onChange={(e) => setDisputeEvidence(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setPreviewDoc(disputeEvidence)}
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
                    respondDispute('dp-1', disputeReply);
                    showToast('Đã gửi giải trình hồ sơ DP-09 tới Admin.', 'success');
                    setScreen('o-disputes');
                  }}
                >
                  Gửi giải trình
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-disputes')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 3. o-refunds */}
      {activeScreen === 'o-refunds' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-disputes')}
            >
              ← Danh sách phản ánh
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-refund-policy')}
            >
              Cấu hình chính sách hoàn
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
                Yêu cầu hoàn tiền từ khách hàng
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.refunds.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ HOÀN</th>
                    <th>MÃ ĐƠN</th>
                    <th>KHÁCH HÀNG</th>
                    <th>SỐ TIỀN</th>
                    <th>LÝ DO</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.refunds.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 700 }}>{r.code}</td>
                      <td>{r.orderCode}</td>
                      <td>{r.customerName}</td>
                      <td>{r.amount}</td>
                      <td>{r.reason}</td>
                      <td>
                        <span
                          className={`badge ${
                            r.status === 'APPROVED' || r.status === 'TRANSFERRED'
                              ? 'badge-success'
                              : r.status === 'REJECTED'
                                ? 'badge-danger'
                                : 'badge-warning'
                          }`}
                        >
                          {r.status === 'PENDING'
                            ? 'Chờ xem xét'
                            : r.status === 'APPROVED'
                              ? 'Đã duyệt hoàn'
                              : r.status === 'TRANSFERRED'
                                ? 'Đã hoàn tiền'
                                : 'Từ chối'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setScreen('o-refund-review')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Xử lý →
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

      {/* 4. o-refund-review */}
      {activeScreen === 'o-refund-review' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Đang xem xét"
          />
          <FigmaContextGrid
            items={[
              { label: 'Mã yêu cầu & Đơn vé', value: 'RF-024 · Đơn TK-1024 (Nguyễn Minh Anh)' },
              { label: 'Ghế & Giá trị hoàn', value: 'Ghế C04, C05 (VIP) · 1.800.000đ' },
              { label: 'Thời điểm gửi yêu cầu', value: 'Trước giờ diễn 96 giờ · Đủ điều kiện hoàn' },
              { label: 'Chính sách áp dụng', value: 'Hoàn theo quy định sự kiện & giải phóng ghế C04, C05' },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('MinhChungHoanVe_RF024.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                reviewOrgRefund('rf-1', true);
                showToast('Đã đồng ý hoàn tiền yêu cầu RF-024.', 'success');
                setScreen('o-refund-outcome');
              }}
            >
              Chấp thuận hoàn vé
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                reviewOrgRefund('rf-1', false);
                showToast('Đã từ chối yêu cầu hoàn tiền RF-024.', 'warning');
                setScreen('o-refund-outcome');
              }}
            >
              Từ chối yêu cầu
            </button>
          </div>
        </div>
      )}

      {/* 5. o-refund-outcome */}
      {activeScreen === 'o-refund-outcome' && (
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
            Đã ghi nhận quyết định xử lý hoàn tiền
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14, lineHeight: 1.5 }}>
            Hệ thống đã chuyển lệnh hoàn tiền sang bộ phận Tài chính Admin và mở bán lại ghế C04, C05 trên sơ đồ.
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            RF-024 · Đã xử lý
          </span>
          <button type="button" className="btn btn-primary" onClick={() => setScreen('o-refunds')}>
            Danh sách hoàn tiền
          </button>
        </div>
      )}

      {/* 6. o-refund-policy */}
      {activeScreen === 'o-refund-policy' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Chính sách hoàn vé
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Sự kiện áp dụng</label>
                <input className="form-input" readOnly value="Đêm nhạc Mùa Thu" />
              </div>
              <div>
                <label className="form-label">Điều khoản hoàn tiền hiển thị cho khách</label>
                <input
                  className="form-input"
                  value={policyRule}
                  onChange={(e) => setPolicyRule(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã lưu chính sách hoàn vé sự kiện.', 'success');
                    setScreen('o-refunds');
                  }}
                >
                  Lưu chính sách
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-refunds')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 7. o-empty */}
      {activeScreen === 'o-empty' && (
        <div
          className="card"
          style={{
            padding: '58px 32px',
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
              background: '#FAF7F2',
              color: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Inbox size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Chưa có bản ghi nào trong danh sách
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 440, marginBottom: 18 }}>
            Khi có dữ liệu phát sinh từ sự kiện hoặc khách hàng, danh sách sẽ hiển thị tại đây.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setScreen('o-disputes')}
          >
            Quay lại danh sách chính
          </button>
        </div>
      )}

      {/* 8. o-error */}
      {activeScreen === 'o-error' && (
        <div
          className="card"
          style={{
            padding: '58px 32px',
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
              background: '#FDECEC',
              color: '#C93535',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <AlertOctagon size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Không thể tải dữ liệu từ máy chủ
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 440, marginBottom: 18 }}>
            Kết nối tạm thời bị gián đoạn. Vui lòng thử tải lại trang hoặc kiểm tra trạng thái mạng.
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              showToast('Đã kết nối lại thành công.', 'success');
              setScreen('o-disputes');
            }}
          >
            Thử tải lại
          </button>
        </div>
      )}

      {/* 9. o-forbidden */}
      {activeScreen === 'o-forbidden' && (
        <div
          className="card"
          style={{
            padding: '58px 32px',
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
            <ShieldAlert size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Tài khoản không có quyền thực hiện thao tác này
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 460, marginBottom: 18 }}>
            Chức năng cấu hình tài khoản ngân hàng và phê duyệt hoàn tiền chỉ dành cho vai trò Owner hoặc Finance.
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/org')}>
            Về trang Tổng quan
          </button>
        </div>
      )}

      {/* 10. o-loading */}
      {activeScreen === 'o-loading' && (
        <div
          className="card"
          style={{
            padding: '58px 32px',
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
              background: '#EDF3FF',
              color: '#1F4B99',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Loader2 size={24} />
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Đang đồng bộ trạng thái ghế & giao dịch...
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 440, marginBottom: 18 }}>
            Hệ thống đang cập nhật dữ liệu thời gian thực từ các cổng soát vé.
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setScreen('o-disputes')}
          >
            Hoàn tất đồng bộ
          </button>
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc}
          organization="Ánh Trăng Events"
          status="Tài liệu đối chiếu"
        />
      )}
    </div>
  );
}
