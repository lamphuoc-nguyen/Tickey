import {
  CheckCircle2,
  Eye,
  Search,
  Download,
} from 'lucide-react';
import { useState } from 'react';
import { useMockStore, exportToCsv, type PayoutItem } from '../../lib/mock-store';

export function AdminPayoutsPage() {
  const payouts = useMockStore((state) => state.payouts);
  const approveFirstPayout = useMockStore((state) => state.approveFirstPayout);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPayout, setSelectedPayout] = useState<PayoutItem | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const filtered = payouts.filter((p) => {
    if (!searchTerm) return true;
    return (
      p.organizer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.eventName.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleFirstApproval = (id: string) => {
    approveFirstPayout(id);
    setSelectedPayout(null);
    setActionSuccess(`Đã ký duyệt người thứ nhất cho lệnh ${id}. Lệnh được chuyển sang Hàng đợi người duyệt thứ hai.`);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleExportExcel = () => {
    const headers = [
      'Mã lệnh chi trả',
      'Đơn vị thụ hưởng',
      'Sự kiện',
      'Doanh thu gốc',
      'Phí nền tảng (3.5%)',
      'Thực nhận',
      'Thông tin ngân hàng',
      'Trạng thái',
      'Thời gian tạo',
    ];

    const rows = filtered.map((p) => [
      p.id,
      p.organizer,
      p.eventName,
      p.grossAmount,
      p.feeAmount,
      p.netPayout,
      p.bankInfo,
      p.status === 'COMPLETED'
        ? 'Đã chi trả'
        : p.status === 'PENDING_SECOND'
        ? 'Cần người duyệt 2'
        : 'Chờ duyệt 1',
      p.createdAt || 'N/A',
    ]);

    exportToCsv(`Tickey_Lenh_Chi_Tra_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    setActionSuccess(`Đã xuất file dữ liệu Excel/CSV danh sách ${rows.length} lệnh chi trả!`);
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
              Chi trả doanh thu & Hoàn tiền
            </h1>
            <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
              Quản lý dòng tiền bán vé, ký duyệt giải ngân cho ban tổ chức sau đối soát sự kiện.
            </p>
          </div>

          <button
            onClick={handleExportExcel}
            className="btn btn-outline"
            style={{ fontSize: '13px' }}
          >
            <Download size={16} style={{ marginRight: '6px' }} />
            <span>Xuất file Excel</span>
          </button>
        </div>
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
            {payouts.filter((p) => p.status !== 'COMPLETED').length} lệnh đang chờ
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Tuân thủ quy trình kiểm soát 2 người duyệt
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
            placeholder="Tìm theo đơn vị, sự kiện, mã PO…"
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
          Tổng cộng <strong>{filtered.length}</strong> lệnh chi trả
        </div>
      </div>

      {/* Payouts Table */}
      <div
        style={{
          backgroundColor: 'var(--surface)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          overflowX: 'auto',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <table className="table" style={{ width: '100%', minWidth: '1100px', margin: 0 }}>
          <thead>
            <tr>
              <th style={{ width: '90px', whiteSpace: 'nowrap' }}>Mã lệnh</th>
              <th style={{ minWidth: '220px' }}>Đơn vị thụ hưởng</th>
              <th style={{ minWidth: '220px' }}>Sự kiện</th>
              <th style={{ whiteSpace: 'nowrap' }}>Doanh thu gốc</th>
              <th style={{ whiteSpace: 'nowrap' }}>Phí nền tảng</th>
              <th style={{ whiteSpace: 'nowrap' }}>Thực nhận</th>
              <th style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>Trạng thái</th>
              <th style={{ textAlign: 'right', whiteSpace: 'nowrap', width: '120px' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                  <strong style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text)' }}>{item.id}</strong>
                </td>
                <td style={{ verticalAlign: 'middle' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '13.5px' }}>{item.organizer}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--muted)', marginTop: '3px' }}>{item.bankInfo}</div>
                </td>
                <td style={{ fontSize: '13px', color: 'var(--text)', verticalAlign: 'middle' }}>{item.eventName}</td>
                <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle', fontWeight: 500, fontSize: '13px' }}>{item.grossAmount}</td>
                <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle', color: 'var(--muted)', fontSize: '12px' }}>{item.feeAmount}</td>
                <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                  <strong style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: 700 }}>{item.netPayout}</strong>
                </td>
                <td style={{ whiteSpace: 'nowrap', verticalAlign: 'middle', textAlign: 'center' }}>
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
                <td style={{ textAlign: 'right', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => setSelectedPayout(item)}
                    className="btn btn-outline"
                    style={{ fontSize: '12px', padding: '6px 14px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center' }}
                  >
                    <Eye size={14} style={{ marginRight: '6px' }} />
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
              maxWidth: '560px',
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
                <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                  Sự kiện: {selectedPayout.eventName}
                </div>
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
