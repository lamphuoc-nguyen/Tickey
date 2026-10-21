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

const ADMIN_RECON_SCREENS: FigmaScreenOption[] = [
  { id: 'a-settlements', label: 'Kỳ đối soát toàn nền tảng' },
  { id: 'a-settlement-detail', label: 'Chi tiết đối soát · STL-2026-10A' },
  { id: 'a-settlement-2', label: 'Chi tiết đối soát · STL-2026-10B' },
  { id: 'a-reconciliation', label: 'Đối chiếu cổng thanh toán (Gateway)' },
  { id: 'a-reconciliation-import', label: 'Tải lên sao kê cổng thanh toán' },
];

export function AdminReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { runAdminReconciliationImport } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'a-settlements';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [stmtFile, setStmtFile] = useState('VNPay_Statement_2026_10_21.csv (214 giao dịch)');

  const screenMeta =
    ADMIN_RECON_SCREENS.find((s) => s.id === activeScreen) || ADMIN_RECON_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ADMIN"
        title={screenMeta.label}
        screens={ADMIN_RECON_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. a-settlements */}
      {activeScreen === 'a-settlements' && (
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
                  placeholder="Tìm theo mã kỳ STL-..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('a-reconciliation')}
              >
                Đối chiếu Gateway
              </button>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('a-reconciliation-import')}
            >
              + Nhập sao kê ngân hàng
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
                Danh sách kỳ đối soát tổ chức
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>2 bản ghi</div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ KỲ</th>
                    <th>TỔ CHỨC</th>
                    <th>DOANH THU GỘP</th>
                    <th>THỰC NHẬN RÒNG</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700 }}>STL-2026-10A</td>
                    <td>Ánh Trăng Events</td>
                    <td>72.400.000đ</td>
                    <td>64.200.000đ</td>
                    <td>
                      <span className="badge badge-success">Đã chốt sổ</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('a-settlement-detail')}
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
                  <tr>
                    <td style={{ fontWeight: 700 }}>STL-2026-10B</td>
                    <td>Ánh Trăng Events</td>
                    <td>56.000.000đ</td>
                    <td>44.940.000đ</td>
                    <td>
                      <span className="badge badge-warning">Đang đối soát</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('a-settlement-2')}
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
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. a-settlement-detail */}
      {activeScreen === 'a-settlement-detail' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Kỳ STL-2026-10A"
          />
          <FigmaContextGrid
            items={[
              { label: 'Kỳ đối soát & Tổ chức', value: 'STL-2026-10A (01/10 – 15/10) · Ánh Trăng Events' },
              { label: 'Doanh thu gộp & Phí nền tảng', value: '72.400.000đ · Phí 5%: 3.620.000đ' },
              { label: 'Hoàn tiền & Dự phòng', value: 'Hoàn: 1.800.000đ · Dự phòng 2.780.000đ' },
              { label: 'Giá trị chuyển sang Payout', value: '64.200.000đ (Lệnh PO-8821)' },
            ]}
          />
          <FigmaDocumentRow onView={() => setPreviewDoc('BienBanDoiSoat_STL_2026_10A.pdf')} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('a-reconciliation')}
            >
              Xem khớp lệnh Gateway
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('a-settlement-2')}
            >
              Chuyển sang Kỳ 10B
            </button>
          </div>
        </div>
      )}

      {/* 3. a-settlement-2 */}
      {activeScreen === 'a-settlement-2' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Kỳ STL-2026-10B"
          />
          <FigmaContextGrid
            items={[
              { label: 'Kỳ đối soát & Tổ chức', value: 'STL-2026-10B (16/10 – 31/10) · Ánh Trăng Events' },
              { label: 'Doanh thu gộp hiện tại', value: '56.000.000đ · Đang mở bán Đêm 2' },
              { label: 'Chênh lệch cổng thanh toán', value: '0đ · Khớp 100% giao dịch VNPay & MoMo' },
              { label: 'Ngày chốt sổ dự kiến', value: '01/11/2026 · 09:00' },
            ]}
          />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setScreen('a-settlements')}
          >
            Quay lại danh sách kỳ đối soát
          </button>
        </div>
      )}

      {/* 4. a-reconciliation */}
      {activeScreen === 'a-reconciliation' && (
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
              Bảng đối chiếu bút toán Cổng thanh toán vs Hệ thống Tickey
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setScreen('a-reconciliation-import')}
              >
                + Tải sao kê CSV
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setScreen('a-settlements')}
              >
                Quay lại
              </button>
            </div>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>NGÀY</th>
                  <th>CỔNG THANH TOÁN</th>
                  <th>SỐ GIAO DỊCH</th>
                  <th>TỔNG TIỀN SAO KÊ</th>
                  <th>CHÊNH LỆCH</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 700 }}>21/10/2026</td>
                  <td>VNPay QR & Thẻ nội địa</td>
                  <td>164</td>
                  <td>98.400.000đ</td>
                  <td>0đ</td>
                  <td>
                    <span className="badge badge-success">Khớp 100%</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 700 }}>21/10/2026</td>
                  <td>Ví MoMo / Quốc tế</td>
                  <td>50</td>
                  <td>30.000.000đ</td>
                  <td>0đ</td>
                  <td>
                    <span className="badge badge-success">Khớp 100%</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. a-reconciliation-import */}
      {activeScreen === 'a-reconciliation-import' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Tải lên tệp sao kê đối soát từ Cổng thanh toán
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
                Tệp sao kê CSV / MT940
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>{stmtFile}</div>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                Chọn tệp sao kê khác
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setStmtFile(`${f.name} (214 giao dịch)`);
                  }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  runAdminReconciliationImport(stmtFile);
                  showToast('Đã đối chiếu tự động 214 giao dịch khớp 100%.', 'success');
                  setScreen('a-reconciliation');
                }}
              >
                Chạy đối chiếu tự động
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('a-reconciliation')}
              >
                Hủy
              </button>
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
          status="Biên bản đối soát"
        />
      )}
    </div>
  );
}
