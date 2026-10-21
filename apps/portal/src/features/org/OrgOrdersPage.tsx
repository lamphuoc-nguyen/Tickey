import { useState } from 'react';
import { useSearchParams } from 'react-router';
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

const ORDER_SCREENS: FigmaScreenOption[] = [
  { id: 'o-orders', label: 'Đơn vé khách hàng' },
  { id: 'o-order-detail', label: 'Chi tiết đơn vé · TK-1024' },
  { id: 'o-comp', label: 'Danh sách vé mời (COMP)' },
  { id: 'o-comp-create', label: 'Phát hành vé mời lẻ' },
  { id: 'o-comp-import', label: 'Nhập danh sách COMP từ CSV' },
  { id: 'o-comp-import-review', label: 'Kiểm tra danh sách CSV' },
  { id: 'o-comp-import-confirm', label: 'Xác nhận phát hành hàng loạt' },
  { id: 'o-comp-result', label: 'Đã phát hành vé mời COMP' },
];

export function OrgOrdersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, issueCompTicket, importCompCsv } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-orders';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const [compGuest, setCompGuest] = useState('Nguyễn Hoàng Yến');
  const [compEmail, setCompEmail] = useState('yen.nguyen@partner.vn');
  const [compSeat, setCompSeat] = useState('G04 (Hàng G · COMP)');
  const [compNote, setCompNote] = useState('Đại diện truyền thông báo chí');

  const [csvFile, setCsvFile] = useState('DanhSach_KhachMoi_DemNhacMuaThu.csv (12 khách)');

  const screenMeta = ORDER_SCREENS.find((s) => s.id === activeScreen) || ORDER_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={ORDER_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. o-orders */}
      {activeScreen === 'o-orders' && (
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
                  placeholder="Tìm theo tên, mã, email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-comp')}
              >
                Vé mời (COMP)
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => showToast('Đã xuất danh sách đơn vé ra CSV.', 'success')}
              >
                Xuất CSV
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setScreen('o-comp-create')}
              >
                + Phát hành COMP
              </button>
            </div>
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
                Tất cả danh sách
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.orders.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ ĐƠN</th>
                    <th>KHÁCH HÀNG</th>
                    <th>SUẤT DIỄN</th>
                    <th>GHẾ / HẠNG</th>
                    <th>TỔNG TIỀN</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {state.orders.map((o) => (
                    <tr key={o.id}>
                      <td style={{ fontWeight: 700 }}>{o.code}</td>
                      <td>{o.customerName}</td>
                      <td>{o.sessionName}</td>
                      <td>{o.seats}</td>
                      <td>{o.total}</td>
                      <td>
                        <span
                          className={`badge ${
                            o.status === 'PAID'
                              ? 'badge-success'
                              : o.status === 'COMP'
                                ? 'badge-info'
                                : 'badge-warning'
                          }`}
                        >
                          {o.status === 'PAID'
                            ? 'Đã thanh toán'
                            : o.status === 'COMP'
                              ? 'Vé mời COMP'
                              : 'Yêu cầu hoàn'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => setScreen('o-order-detail')}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Chi tiết →
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

      {/* 2. o-order-detail */}
      {activeScreen === 'o-order-detail' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Đã thanh toán"
          />
          <FigmaContextGrid
            items={[
              { label: 'Mã đơn & Khách hàng', value: 'TK-1024 · Nguyễn Minh Anh (minhanh@gmail.com)' },
              { label: 'Sự kiện & Suất diễn', value: 'Đêm nhạc Mùa Thu · Đêm 1 (24/10/2026 20:00)' },
              { label: 'Ghế & Hạng vé', value: 'C04, C05 · Hạng VIP (2 × 900.000đ)' },
              { label: 'Thanh toán & Check-in', value: '1.800.000đ qua VNPay · Chưa check-in' },
            ]}
          />
          <FigmaDocumentRow
            title="Vé điện tử & Hóa đơn biên nhận"
            subtitle="Kiểm tra mã QR định danh ghế trước khi gửi lại email cho khách"
            buttonLabel="Xem vé PDF"
            onView={() => setPreviewDoc('VeDienTu_TK1024_C04_C05.pdf')}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => showToast('Đã gửi lại email vé điện tử cho khách hàng.', 'success')}
            >
              Gửi lại email vé
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-orders')}
            >
              Quay lại danh sách đơn
            </button>
          </div>
        </div>
      )}

      {/* 3. o-comp */}
      {activeScreen === 'o-comp' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-orders')}
            >
              ← Đơn vé thương mại
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-comp-import')}
              >
                Nhập CSV hàng loạt
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setScreen('o-comp-create')}
              >
                + Phát hành vé mời lẻ
              </button>
            </div>
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
                Danh sách vé mời nội bộ (COMP) · Hàng G
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {state.compTickets.length} bản ghi
              </div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ COMP</th>
                    <th>KHÁCH MỜI</th>
                    <th>EMAIL NHẬN VÉ</th>
                    <th>GHẾ</th>
                    <th>NHÓM KHÁCH</th>
                    <th>TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody>
                  {state.compTickets.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 700 }}>{c.code}</td>
                      <td>{c.guestName}</td>
                      <td>{c.email}</td>
                      <td>{c.seat}</td>
                      <td>{c.note}</td>
                      <td>
                        <span className="badge badge-success">Đã gửi vé</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. o-comp-create */}
      {activeScreen === 'o-comp-create' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Phát hành vé COMP
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Họ tên khách mời</label>
                <input
                  className="form-input"
                  value={compGuest}
                  onChange={(e) => setCompGuest(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Email nhận vé QR</label>
                <input
                  className="form-input"
                  value={compEmail}
                  onChange={(e) => setCompEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Ghế chỉ định (Quota Hàng G)</label>
                <input
                  className="form-input"
                  value={compSeat}
                  onChange={(e) => setCompSeat(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Ghi chú / Đơn vị</label>
                <input
                  className="form-input"
                  value={compNote}
                  onChange={(e) => setCompNote(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    issueCompTicket({
                      guestName: compGuest,
                      email: compEmail,
                      seat: compSeat.split(' ')[0],
                      note: compNote,
                    });
                    showToast(`Đã phát hành vé mời COMP cho ${compGuest}.`, 'success');
                    setScreen('o-comp-result');
                  }}
                >
                  Phát hành & gửi vé
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-comp-import')}
                >
                  Nhập từ CSV
                </button>
              </div>
            </div>
          </div>
          <FigmaEventPreviewCard />
        </div>
      )}

      {/* 5. o-comp-import */}
      {activeScreen === 'o-comp-import' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Tải lên tệp CSV khách mời COMP
            </div>
            <div
              style={{
                border: '1.5px dashed var(--border)',
                borderRadius: 12,
                padding: '24px 20px',
                textAlign: 'center',
                background: '#FAF7F2',
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                Tệp mẫu CSV (HoTen, Email, MaGhe, DonVi)
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>{csvFile}</div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                Chọn tệp CSV khác
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setCsvFile(`${f.name} (12 khách)`);
                  }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setScreen('o-comp-import-review')}
              >
                Kiểm tra dữ liệu CSV
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-comp')}
              >
                Quay lại
              </button>
            </div>
          </div>
          <FigmaEventPreviewCard />
        </div>
      )}

      {/* 6. o-comp-import-review */}
      {activeScreen === 'o-comp-import-review' && (
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
              Kết quả kiểm tra tệp CSV · 3 dòng hợp lệ
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setScreen('o-comp-import-confirm')}
              >
                Tiếp tục xác nhận
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setScreen('o-comp-import')}
              >
                Tải lại tệp
              </button>
            </div>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>DÒNG</th>
                  <th>KHÁCH MỜI</th>
                  <th>EMAIL</th>
                  <th>GHẾ CHỈ ĐỊNH</th>
                  <th>KIỂM TRA GHẾ</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>#1</td>
                  <td style={{ fontWeight: 700 }}>Đặng Quốc Khánh</td>
                  <td>khanh.dang@sponsor.vn</td>
                  <td>G05</td>
                  <td>
                    <span className="badge badge-success">Hợp lệ · Trống</span>
                  </td>
                </tr>
                <tr>
                  <td>#2</td>
                  <td style={{ fontWeight: 700 }}>Võ Bích Ngọc</td>
                  <td>ngoc.vo@press.vn</td>
                  <td>G06</td>
                  <td>
                    <span className="badge badge-success">Hợp lệ · Trống</span>
                  </td>
                </tr>
                <tr>
                  <td>#3</td>
                  <td style={{ fontWeight: 700 }}>Trịnh Gia Huy</td>
                  <td>huy.trinh@artist.vn</td>
                  <td>G07</td>
                  <td>
                    <span className="badge badge-success">Hợp lệ · Trống</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. o-comp-import-confirm */}
      {activeScreen === 'o-comp-import-confirm' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Sẵn sàng phát hành"
          />
          <FigmaContextGrid
            items={[
              { label: 'Sự kiện & Suất diễn', value: 'Đêm nhạc Mùa Thu · Đêm 1 (24/10/2026)' },
              { label: 'Số lượng phát hành', value: '3 vé mời COMP · Ghế G05, G06, G07' },
              { label: 'Quota COMP còn lại', value: 'Còn 3 / 10 ghế Hàng G sau khi phát hành' },
              { label: 'Phương thức gửi', value: 'Gửi email kèm mã QR định danh từng ghế' },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                importCompCsv();
                showToast('Đã phát hành hàng loạt 3 vé COMP từ CSV.', 'success');
                setScreen('o-comp-result');
              }}
            >
              Xác nhận phát hành 3 vé COMP
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-comp-import-review')}
            >
              Quay lại kiểm tra
            </button>
          </div>
        </div>
      )}

      {/* 8. o-comp-result */}
      {activeScreen === 'o-comp-result' && (
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
            Đã phát hành vé mời COMP thành công
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 480, marginBottom: 14, lineHeight: 1.5 }}>
            Hệ thống đã khóa ghế tương ứng trên sơ đồ Đêm 1 và gửi vé điện tử QR đến email của từng khách mời.
          </div>
          <span className="badge badge-success" style={{ marginBottom: 18 }}>
            Issued · Hàng G
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-comp')}
            >
              Xem danh sách COMP
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-orders')}
            >
              Đơn vé khách hàng
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
          status="Vé điện tử hợp lệ"
        />
      )}
    </div>
  );
}
