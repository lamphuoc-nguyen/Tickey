import {
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useState } from 'react';

export function AdminReconciliationPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [selectedGateway, setSelectedGateway] = useState('MoMo');

  const gateways = [
    { name: 'Cổng MoMo QR & ATM', transactions: 1420, systemTotal: '1.420.000.000 đ', gatewayTotal: '1.420.000.000 đ', diff: '0 đ', status: 'MATCHED' },
    { name: 'Cổng VNPAY-QR', transactions: 980, systemTotal: '980.000.000 đ', gatewayTotal: '980.000.000 đ', diff: '0 đ', status: 'MATCHED' },
    { name: 'VietQR Chuyển khoản', transactions: 2450, systemTotal: '2.450.000.000 đ', gatewayTotal: '2.450.000.000 đ', diff: '0 đ', status: 'MATCHED' },
  ];

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncDone(true);
      setTimeout(() => setSyncDone(false), 4000);
    }, 1200);
  };

  const handleSimulateImport = () => {
    setShowImportModal(false);
    setImportSuccess(`Đã nạp thành công 2,450 bản ghi sao kê từ cổng ${selectedGateway}. Đối soát tự động hoàn tất!`);
    setTimeout(() => setImportSuccess(null), 4500);
  };

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            fontSize: '12px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}
        >
          TICKEY / ADMIN / RECONCILIATION
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '28px',
                fontWeight: 700,
                color: 'var(--text)',
                margin: 0,
              }}
            >
              Đối soát cổng thanh toán
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
              Khớp nối dữ liệu giao dịch bán vé hệ thống Tickey với báo cáo sao kê từ ngân hàng và cổng thanh toán.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowImportModal(true)}
              className="btn btn-outline"
              style={{ fontSize: '13px' }}
            >
              <FileSpreadsheet size={16} style={{ marginRight: '6px' }} />
              Nhập sao kê cổng
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="btn btn-primary"
              style={{ fontSize: '13px' }}
            >
              <RefreshCw size={16} style={{ marginRight: '6px' }} />
              {isSyncing ? 'Đang đối soát…' : 'Chạy đối soát tự động'}
            </button>
          </div>
        </div>
      </div>

      {importSuccess && (
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{importSuccess}</span>
        </div>
      )}

      {syncDone && (
        <div
          style={{
            padding: '14px 20px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>Đối soát thành công! 100% giao dịch khớp với số dư ghi nhận tại cổng.</span>
        </div>
      )}

      {/* Summary Table */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table className="table" style={{ width: '100%', margin: 0 }}>
          <thead>
            <tr>
              <th>Cổng đối tác</th>
              <th>Số lượng giao dịch</th>
              <th>Ghi nhận Tickey</th>
              <th>Sao kê cổng</th>
              <th>Chênh lệch</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {gateways.map((g) => (
              <tr key={g.name}>
                <td>
                  <strong>{g.name}</strong>
                </td>
                <td>{g.transactions.toLocaleString()} GD</td>
                <td>{g.systemTotal}</td>
                <td>{g.gatewayTotal}</td>
                <td style={{ color: 'var(--success)', fontWeight: 600 }}>{g.diff}</td>
                <td>
                  <span className="badge badge-success">Khớp 100%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Import Statement Modal */}
      {showImportModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={20} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '19px', fontWeight: 700 }}>Nhập sao kê cổng thanh toán</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="btn-ghost"
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '18px' }}>
              Tải lên tệp CSV/Excel xuất từ trang quản trị của cổng thanh toán MoMo, VNPay hoặc ngân hàng VietinBank/Vietcombank để đối soát chéo.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Chọn cổng thanh toán nguồn:
                </label>
                <select
                  value={selectedGateway}
                  onChange={(e) => setSelectedGateway(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="MoMo">Ví điện tử MoMo</option>
                  <option value="VNPAY">Cổng thanh toán VNPAY-QR</option>
                  <option value="VietQR / Vietcombank">VietQR / Chuyển khoản Vietcombank</option>
                </select>
              </div>

              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '24px 16px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg)',
                  cursor: 'pointer',
                }}
                onClick={handleSimulateImport}
              >
                <Upload size={32} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text)' }}>
                  Kéo thả file .xlsx / .csv hoặc nhấp để chọn tệp mẫu
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  Hỗ trợ tệp bảng sao kê giao dịch từ 01/10/2026 - 20/10/2026
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="btn btn-outline"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSimulateImport}
                  className="btn btn-primary"
                >
                  Nạp & Tiến hành đối soát
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
