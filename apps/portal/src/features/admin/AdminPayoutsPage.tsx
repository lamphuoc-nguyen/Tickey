import {
  CheckCircle2,
  Eye,
  Search,
} from 'lucide-react';
import { useState } from 'react';

interface PayoutItem {
  id: string;
  organizer: string;
  eventName: string;
  grossAmount: string;
  feeAmount: string;
  netPayout: string;
  bankInfo: string;
  status: 'PENDING_FIRST' | 'PENDING_SECOND' | 'COMPLETED';
}

export function AdminPayoutsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayout, setSelectedPayout] = useState<PayoutItem | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [payouts, setPayouts] = useState<PayoutItem[]>([
    {
      id: 'PO-014',
      organizer: 'Ánh Trăng Events',
      eventName: 'Indie Soul Acoustic Night',
      grossAmount: '331.600.000 VNĐ',
      feeAmount: '11.600.000 VNĐ (3.5%)',
      netPayout: '320.000.000 VNĐ',
      bankInfo: '0071009876543 · Vietcombank Nam Sài Gòn',
      status: 'PENDING_SECOND',
    },
    {
      id: 'PO-015',
      organizer: 'Sóng Việt Events',
      eventName: 'Đêm nhạc Mùa Thu (Tạm ứng đợt 1)',
      grossAmount: '518.000.000 VNĐ',
      feeAmount: '18.000.000 VNĐ (3.5%)',
      netPayout: '500.000.000 VNĐ',
      bankInfo: '0071001234567 · Vietcombank TP.HCM',
      status: 'PENDING_FIRST',
    },
    {
      id: 'PO-011',
      organizer: 'Royal Music Vietnam',
      eventName: 'Hòa nhạc Thính phòng Mùa Hạ',
      grossAmount: '186.400.000 VNĐ',
      feeAmount: '6.400.000 VNĐ (3.5%)',
      netPayout: '180.000.000 VNĐ',
      bankInfo: '19034567890123 · Techcombank Thăng Long',
      status: 'COMPLETED',
    },
  ]);

  const filtered = payouts.filter((p) => {
    if (!searchTerm) return true;
    return (
      p.organizer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleFirstApproval = (id: string) => {
    setPayouts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: 'PENDING_SECOND' } : p))
    );
    setSelectedPayout(null);
    setActionSuccess(`Đã ký duyệt người thứ nhất cho lệnh ${id}. Lệnh được chuyển sang Hàng đợi người duyệt thứ hai.`);
    setTimeout(() => setActionSuccess(null), 4000);
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
          TICKEY / ADMIN / PAYOUTS & REFUNDS
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
          Chi trả doanh thu & Hoàn tiền
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
          Quản lý dòng tiền bán vé, ký duyệt giải ngân cho ban tổ chức sau đối soát sự kiện.
        </p>
      </div>

      {actionSuccess && (
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
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Financial KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '20px',
          marginBottom: '28px',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
            Tổng tiền giữ hộ (Escrow)
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--text)' }}>
            4.850.000.000 đ
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Bảo đảm thanh toán 12 sự kiện
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
            Chờ giải ngân (Pending Payouts)
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--primary)' }}>
            820.000.000 đ
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            2 lệnh đang chờ quy trình 2 người duyệt
          </div>
        </div>

        <div
          style={{
            backgroundColor: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            padding: '24px',
          }}
        >
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
            Phí dịch vụ nền tảng Tickey
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: 'var(--success)' }}>
            169.750.000 đ
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Tính theo biểu phí 3.5%
          </div>
        </div>
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
            placeholder="Tìm theo đơn vị, mã PO…"
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
      </div>

      {/* Payouts Table */}
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
              <th>Mã lệnh</th>
              <th>Đơn vị thụ hưởng</th>
              <th>Sự kiện</th>
              <th>Doanh thu gốc</th>
              <th>Phí nền tảng</th>
              <th>Thực nhận</th>
              <th>Trạng thái</th>
              <th style={{ textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--text)' }}>{item.id}</strong>
                </td>
                <td>
                  <strong>{item.organizer}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.bankInfo}</div>
                </td>
                <td style={{ fontSize: '13px' }}>{item.eventName}</td>
                <td>{item.grossAmount}</td>
                <td style={{ color: 'var(--muted)', fontSize: '12px' }}>{item.feeAmount}</td>
                <td>
                  <strong style={{ color: 'var(--primary)' }}>{item.netPayout}</strong>
                </td>
                <td>
                  {item.status === 'PENDING_FIRST' && (
                    <span className="badge badge-warning">Chờ duyệt 1</span>
                  )}
                  {item.status === 'PENDING_SECOND' && (
                    <span className="badge badge-info">Cần người duyệt 2</span>
                  )}
                  {item.status === 'COMPLETED' && (
                    <span className="badge badge-success">Đã chi trả</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    onClick={() => setSelectedPayout(item)}
                    className="btn btn-outline"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    <Eye size={14} style={{ marginRight: '4px' }} />
                    Chi tiết
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedPayout && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(23, 42, 53, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '24px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: 'var(--shadow-lg)',
              padding: '32px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border)',
                paddingBottom: '16px',
              }}
            >
              <div>
                <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                  LỆNH CHI TRẢ DOANH THU · {selectedPayout.id}
                </span>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    margin: '4px 0 0',
                    color: 'var(--text)',
                  }}
                >
                  {selectedPayout.organizer}
                </h2>
              </div>
              <button
                onClick={() => setSelectedPayout(null)}
                className="btn-ghost"
                style={{ fontSize: '18px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                  Tài khoản nhận tiền (Đã xác minh KYC)
                </div>
                <strong style={{ fontSize: '14px', color: 'var(--text)' }}>{selectedPayout.bankInfo}</strong>
              </div>

              <div style={{ backgroundColor: 'var(--bg)', padding: '14px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Tổng doanh thu bán vé:</span>
                  <strong>{selectedPayout.grossAmount}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--muted)' }}>Khấu trừ phí nền tảng Tickey (3.5%):</span>
                  <span style={{ color: 'var(--danger)' }}>-{selectedPayout.feeAmount}</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border)',
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>Thực chi giải ngân:</span>
                  <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>{selectedPayout.netPayout}</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setSelectedPayout(null)}
                className="btn btn-outline"
                style={{ fontSize: '13px' }}
              >
                Đóng
              </button>
              {selectedPayout.status === 'PENDING_FIRST' && (
                <button
                  onClick={() => handleFirstApproval(selectedPayout.id)}
                  className="btn btn-primary"
                  style={{ fontSize: '13px' }}
                >
                  Duyệt lệnh (Người thứ nhất)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
