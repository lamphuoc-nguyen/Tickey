import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';

interface ApprovalItem {
  id: string;
  title: string;
  category: 'PAYOUT' | 'CANCEL_SHOW' | 'ORG_SUSPEND';
  amount?: string;
  firstApprover: string;
  firstApprovedAt: string;
  details: string;
  status: 'PENDING_SECOND' | 'COMPLETED' | 'REJECTED';
}

export function AdminApprovalsPage() {
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [approvals, setApprovals] = useState<ApprovalItem[]>([
    {
      id: 'AP-014',
      title: 'Chi trả doanh thu đợt 1 · Ánh Trăng Events',
      category: 'PAYOUT',
      amount: '320.000.000 VNĐ',
      firstApprover: 'admin-hung@tickey.vn (Quản trị viên 1)',
      firstApprovedAt: '19/10/2026 10:15',
      details: 'Chuyển khoản thanh toán đợt 1 sau khi trừ phí nền tảng 3.5%. STK: 0071009876543 (Vietcombank Nam Sài Gòn).',
      status: 'PENDING_SECOND',
    },
    {
      id: 'AP-024',
      title: 'Hủy suất diễn Đêm 1 do bão · Sóng Việt Events',
      category: 'CANCEL_SHOW',
      firstApprover: 'admin-lan@tickey.vn (Quản trị viên 1)',
      firstApprovedAt: '19/10/2026 09:40',
      details: 'Ban tổ chức xin hủy suất diễn ngày 20/10 do bão đổ bộ theo công điện khẩn của UBND TP. Hoàn tiền 100% cho 1,200 người mua vé.',
      status: 'PENDING_SECOND',
    },
  ]);

  const handleSecondApproval = (id: string) => {
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'COMPLETED' } : a))
    );
    setSelectedItem(null);
    setMfaCode('');
    setActionSuccess(`Phiếu ${id} đã được bạn (người duyệt thứ hai) ký duyệt thành công! Hệ thống bắt đầu xử lý tự động.`);
    setTimeout(() => setActionSuccess(null), 5000);
  };

  const handleReject = (id: string) => {
    setApprovals((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: 'REJECTED' } : a))
    );
    setSelectedItem(null);
    setMfaCode('');
    setActionSuccess(`Đã từ chối phiếu ${id}. Yêu cầu được chuyển về trạng thái hủy.`);
    setTimeout(() => setActionSuccess(null), 5000);
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
          TICKEY / ADMIN / APPROVALS
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
          Hàng đợi phê duyệt (Four-Eyes Principle)
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
          Quy tắc kiểm soát độc lập 2 người duyệt: Các giao dịch chi trả lớn và hủy suất diễn bắt buộc cần 2 Admin phê duyệt để thực thi.
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

      {/* Security Info Card */}
      <div
        style={{
          backgroundColor: 'var(--navy)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          color: '#FFFFFF',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <ShieldCheck size={32} color="#D9422D" />
        <div>
          <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '2px' }}>
            Cơ chế bảo mật kép (Dual Control / Two-Man Rule)
          </div>
          <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.75)' }}>
            Người tạo yêu cầu hoặc người duyệt thứ nhất không thể tự mình thực hiện giao dịch. Bạn đang đăng nhập với tư cách Người duyệt thứ hai (Second Signer).
          </div>
        </div>
      </div>

      {/* Approvals List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {approvals.map((item) => (
          <div
            key={item.id}
            style={{
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--muted)',
                    fontFamily: 'monospace',
                  }}
                >
                  {item.id}
                </span>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: item.category === 'PAYOUT' ? 'var(--primary)' : 'var(--warning)',
                    backgroundColor: item.category === 'PAYOUT' ? 'var(--primary-tint)' : '#FFFBEB',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  {item.category === 'PAYOUT' ? 'Chi trả doanh thu' : 'Hủy suất diễn'}
                </span>
                {item.status === 'PENDING_SECOND' && (
                  <span className="badge badge-warning">Cần người duyệt thứ hai</span>
                )}
                {item.status === 'COMPLETED' && (
                  <span className="badge badge-success">Đã hoàn tất duyệt 2/2</span>
                )}
                {item.status === 'REJECTED' && <span className="badge badge-danger">Đã từ chối</span>}
              </div>

              <h3
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '18px',
                  fontWeight: 700,
                  margin: '0 0 10px',
                  color: 'var(--text)',
                }}
              >
                {item.title}
              </h3>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  fontSize: '13px',
                  color: 'var(--muted)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={15} color="var(--success)" />
                  <span>
                    Duyệt 1: <strong>{item.firstApprover}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={15} color="var(--muted)" />
                  <span>{item.firstApprovedAt}</span>
                </div>
              </div>
            </div>

            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {item.amount && (
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>
                  {item.amount}
                </div>
              )}
              {item.status === 'PENDING_SECOND' ? (
                <button
                  onClick={() => setSelectedItem(item)}
                  className="btn btn-primary"
                  style={{ fontSize: '13px', padding: '10px 20px' }}
                >
                  <ShieldCheck size={16} style={{ marginRight: '6px' }} />
                  Ký duyệt phiếu
                </button>
              ) : (
                <button
                  onClick={() => setSelectedItem(item)}
                  className="btn btn-outline"
                  style={{ fontSize: '13px', padding: '8px 16px' }}
                >
                  Xem chi tiết
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Second Approval Modal (a-approval-review) */}
      {selectedItem && (
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
              maxWidth: '640px',
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
                  PHÊ DUYỆT CẤP 2 · {selectedItem.id}
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
                  {selectedItem.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="btn-ghost"
                style={{ fontSize: '18px', border: 'none', background: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div style={{ backgroundColor: 'var(--bg)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>
                  Thông tin người duyệt thứ nhất
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                  {selectedItem.firstApprover}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                  Thời gian ký duyệt: {selectedItem.firstApprovedAt}
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--bg)', padding: '16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Chi tiết lệnh</div>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)', lineHeight: 1.5 }}>
                  {selectedItem.details}
                </p>
                {selectedItem.amount && (
                  <div style={{ marginTop: '12px', fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>
                    Số tiền thực chi: {selectedItem.amount}
                  </div>
                )}
              </div>

              {selectedItem.status === 'PENDING_SECOND' && (
                <div
                  style={{
                    border: '1px solid var(--border)',
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#FFFDF9',
                  }}
                >
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text)',
                      marginBottom: '8px',
                    }}
                  >
                    Mã xác thực TOTP/2FA của Quản trị viên
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      placeholder="Nhập mã 6 chữ số (VD: 849201)"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      style={{
                        padding: '10px 14px',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '14px',
                        letterSpacing: '2px',
                        fontWeight: 600,
                        flex: 1,
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px', display: 'block' }}>
                    (Trong môi trường thử nghiệm, bạn có thể bấm Duyệt ngay không bắt buộc TOTP)
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              {selectedItem.status === 'PENDING_SECOND' ? (
                <>
                  <button
                    onClick={() => handleReject(selectedItem.id)}
                    className="btn btn-outline"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '13px' }}
                  >
                    Từ chối phiếu
                  </button>
                  <button
                    onClick={() => handleSecondApproval(selectedItem.id)}
                    className="btn btn-primary"
                    style={{ fontSize: '13px', padding: '10px 24px' }}
                  >
                    Ký duyệt hoàn tất (2/2)
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSelectedItem(null)}
                  className="btn btn-outline"
                  style={{ fontSize: '13px' }}
                >
                  Đóng
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
