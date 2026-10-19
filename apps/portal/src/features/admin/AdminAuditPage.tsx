import { Search } from 'lucide-react';
import { useState } from 'react';

export function AdminAuditPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const logs = [
    {
      id: 'LOG-9921',
      timestamp: '19/10/2026 10:15:24',
      actor: 'admin-hung@tickey.vn',
      action: 'APPROVE_PAYOUT_FIRST',
      target: 'PO-014 (Ánh Trăng Events - 320.000.000đ)',
      ip: '118.69.182.42',
      status: 'SUCCESS',
    },
    {
      id: 'LOG-9918',
      timestamp: '19/10/2026 09:40:11',
      actor: 'admin-lan@tickey.vn',
      action: 'APPROVE_CANCEL_SHOW_FIRST',
      target: 'AP-024 (Sóng Việt Events - Đêm 1)',
      ip: '14.161.22.95',
      status: 'SUCCESS',
    },
    {
      id: 'LOG-9892',
      timestamp: '19/10/2026 08:30:00',
      actor: 'system-reconcile-bot',
      action: 'AUTO_RECONCILIATION_RUN',
      target: 'Gateways: MoMo, VNPay, VietQR',
      ip: '10.0.4.12 (Internal)',
      status: 'SUCCESS',
    },
    {
      id: 'LOG-9840',
      timestamp: '18/10/2026 17:22:15',
      actor: 'admin-hung@tickey.vn',
      action: 'KYC_APPROVE',
      target: 'ORG: Ánh Trăng Events (ACTIVE)',
      ip: '118.69.182.42',
      status: 'SUCCESS',
    },
  ];

  const filtered = logs.filter((l) => {
    if (!searchTerm) return true;
    return (
      l.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.target.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

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
          TICKEY / ADMIN / AUDIT LOG
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--text)',
            margin: 0,
          }}
        >
          Nhật ký thao tác hệ thống (Audit Trail)
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
          Ghi nhận toàn bộ thao tác nhạy cảm, phê duyệt lệnh và truy cập quản trị viên bất biến để phục vụ kiểm toán an toàn.
        </p>
      </div>

      {/* Search Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            width: '320px',
          }}
        >
          <Search size={16} color="var(--muted)" />
          <input
            type="text"
            placeholder="Tìm theo actor, hành động, target…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'none',
              outline: 'none',
              fontSize: '13px',
              width: '100%',
            }}
          />
        </div>

        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
          Ghi nhận <strong>{filtered.length}</strong> sự kiện gần nhất
        </div>
      </div>

      {/* Audit Table */}
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
              <th>Thời gian</th>
              <th>Người thực hiện</th>
              <th>Hành động</th>
              <th>Đối tượng tác động</th>
              <th>Địa chỉ IP</th>
              <th>Kết quả</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((log) => (
              <tr key={log.id}>
                <td style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                  {log.timestamp}
                </td>
                <td>
                  <strong style={{ color: 'var(--text)' }}>{log.actor}</strong>
                </td>
                <td>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '12px',
                      padding: '2px 6px',
                      backgroundColor: 'var(--bg)',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {log.action}
                  </span>
                </td>
                <td style={{ fontSize: '13px' }}>{log.target}</td>
                <td style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'monospace' }}>
                  {log.ip}
                </td>
                <td>
                  <span className="badge badge-success">Thành công</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
