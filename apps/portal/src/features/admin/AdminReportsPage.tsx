import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
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

const ADMIN_REPORT_SCREENS: FigmaScreenOption[] = [
  { id: 'a-reports', label: 'Phản ánh & tranh chấp khách hàng' },
  { id: 'a-dispute', label: 'Chi tiết tranh chấp · DP-09' },
  { id: 'a-dispute-12', label: 'Chi tiết tranh chấp · DP-12' },
  { id: 'a-dispute-resolve', label: 'Phán quyết tranh chấp' },
  { id: 'a-support', label: 'Phiếu hỗ trợ kỹ thuật (Support Tickets)' },
  { id: 'a-support-detail', label: 'Chi tiết phiếu hỗ trợ · SUP-204' },
];

export function AdminReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, resolveAdminDispute } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-reports';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const [verdict, setVerdict] = useState('Hoàn tiền 50% thiện chí cho khách hàng (900.000đ)');
  const [verdictNote, setVerdictNote] = useState(
    'Tổ chức đã hỗ trợ đổi suất tại cổng, hỗ trợ hoàn một phần do nhầm lẫn thông tin giờ mở cổng.',
  );

  const [supportReply, setSupportReply] = useState(
    'Đã làm mới chứng chỉ đồng bộ thiết bị tại Cổng G2. Vui lòng quét lại mã QR.',
  );

  const screenMeta =
    ADMIN_REPORT_SCREENS.find((s) => s.id === activeScreen) || ADMIN_REPORT_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_REPORT_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-reports */}
      {activeScreen === 'a-reports' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10 }}>
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
                  placeholder="Tìm theo mã DP-..., mã đơn..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('a-support')}
              >
                Phiếu hỗ trợ kỹ thuật
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
                Tất cả danh sách tranh chấp
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
                    <th>CHỦ ĐỀ</th>
                    <th>HẠN SLA</th>
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
                            d.status === 'RESOLVED' ? 'badge-success' : 'badge-warning'
                          }`}
                        >
                          {d.status === 'RESOLVED' ? 'Đã phán quyết' : 'Đang xử lý'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setScreen(d.code === 'DP-12' ? 'a-dispute-12' : 'a-dispute')
                          }
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. a-dispute (DP-09) */}
      {activeScreen === 'a-dispute' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Tranh chấp DP-09"
          />
          <FigmaContextGrid
            items={[
              { label: 'Mã hồ sơ & Đơn vé', value: 'DP-09 · Đơn TK-1024 (Khách báo lỗi quét QR tại Cổng G1)' },
              { label: 'Giải trình từ Tổ chức', value: 'Khách xuất trình nhầm mã QR của Đêm 2, đã hỗ trợ tại cổng' },
              { label: 'Log thiết bị quét vé', value: 'DEV-G1-01 ghi nhận mã QR hợp lệ cho suất 25/10' },
              { label: 'Trạng thái SLA', value: 'Trong hạn phản hồi · Đủ bằng chứng hai bên' },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('LogQuetVe_CongG1_DP09.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('a-dispute-resolve')}
            >
              Ra phán quyết tranh chấp
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-dispute-12')}
            >
              Xem hồ sơ DP-12
            </button>
          </div>
        </div>
      )}

      {/* 3. a-dispute-12 */}
      {activeScreen === 'a-dispute-12' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Tranh chấp DP-12"
          />
          <FigmaContextGrid
            items={[
              { label: 'Mã hồ sơ & Đơn vé', value: 'DP-12 · Đơn TK-1028 (Ghế bị che khuất tầm nhìn)' },
              { label: 'Vị trí ghế phản ánh', value: 'Hàng E · Ghế E09, E10 (Standard)' },
              { label: 'Đề xuất của Tổ chức', value: 'Nâng hạng miễn phí lên Hàng C (VIP) cho suất kế tiếp' },
              { label: 'Trạng thái', value: 'Khách hàng đồng ý phương án nâng hạng' },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('a-dispute-resolve')}
            >
              Đóng hồ sơ & ghi nhận
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-reports')}
            >
              Quay lại danh sách
            </button>
          </div>
        </div>
      )}

      {/* 4. a-dispute-resolve */}
      {activeScreen === 'a-dispute-resolve' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Phán quyết tranh chấp
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Kết luận xử lý của Admin</label>
                <input
                  className="form-input"
                  value={verdict}
                  onChange={(e) => setVerdict(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Biên bản giải quyết gửi 2 bên</label>
                <input
                  className="form-input"
                  value={verdictNote}
                  onChange={(e) => setVerdictNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    resolveAdminDispute('dp-1', verdict);
                    showToast('Đã ban hành phán quyết và đóng hồ sơ tranh chấp.', 'success');
                    setScreen('a-reports');
                  }}
                >
                  Xác nhận phán quyết
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-dispute')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard icon="shield" />
        </div>
      )}

      {/* 5. a-support */}
      {activeScreen === 'a-support' && (
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
              Phiếu hỗ trợ vận hành từ Tổ chức & Khách hàng
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setScreen('a-reports')}
            >
              ← Hồ sơ tranh chấp
            </button>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>MÃ PHIẾU</th>
                  <th>NGƯỜI GỬI</th>
                  <th>CHỦ ĐỀ</th>
                  <th>MỨC ĐỘ</th>
                  <th>THAO TÁC</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>SUP-204</td>
                  <td>Ánh Trăng Events</td>
                  <td>Hỗ trợ đồng bộ máy quét Cổng G2</td>
                  <td>
                    <span className="badge badge-warning">Cao</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setScreen('a-support-detail')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--primary)',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Phản hồi →
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. a-support-detail */}
      {activeScreen === 'a-support-detail' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Phiếu hỗ trợ SUP-204
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Yêu cầu từ Tổ chức</label>
                <input
                  className="form-input"
                  readOnly
                  value="Ánh Trăng Events · Thiết bị iPad Mini 6 tại Cổng G2 báo trễ đồng bộ."
                />
              </div>
              <div>
                <label className="form-label">Nội dung phản hồi kỹ thuật</label>
                <input
                  className="form-input"
                  value={supportReply}
                  onChange={(e) => setSupportReply(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    showToast('Đã gửi phản hồi kỹ thuật và đóng phiếu SUP-204.', 'success');
                    setScreen('a-support');
                  }}
                >
                  Gửi phản hồi & đóng phiếu
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('a-support')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          title={previewDoc}
          organization="Ánh Trăng Events"
          status="Bằng chứng log hệ thống"
        />
      )}
    </div>
  );
}
