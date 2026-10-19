import {
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';
import { useState } from 'react';

export function AdminReconciliationPage() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              onClick={() => alert('Chức năng nhập file sao kê CSV/Excel từ cổng thanh toán (a-reconciliation-import)')}
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
    </div>
  );
}
