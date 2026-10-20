import { useState, type FormEvent } from 'react';
import { ArrowUpRight, Building2, CheckCircle2, Wallet, Clock, CheckCircle } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';

export function OrgFinancePage() {
  const payouts = useMockStore((state) => state.payouts);
  const requestPayout = useMockStore((state) => state.requestPayout);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState<number>(21060000);
  const [bankName, setBankName] = useState('Vietcombank - CN Tân Định');
  const [accountNumber, setAccountNumber] = useState('0123456789');
  const [accountHolder, setAccountHolder] = useState('CÔNG TY CỔ PHẦN ÁNH TRĂNG');
  const [payoutNote, setPayoutNote] = useState('Chi trả doanh thu đợt 1');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handlePayoutSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!payoutAmount || payoutAmount <= 0) return;

    const newPayout = requestPayout({
      amount: payoutAmount,
      bankName,
      accountNumber,
      accountHolder,
      note: payoutNote,
      organizer: 'Ánh Trăng Events',
      eventName: 'Đêm nhạc Mùa Thu (Đợt 1)',
    });

    setShowPayoutModal(false);
    showToast(
      `Đã gửi thành công lệnh chi trả ${newPayout.id} (${newPayout.grossAmount}) đến Ban Quản trị Tickey duyệt giải ngân!`
    );
  };

  const settlements = [
    {
      id: 'STL-01',
      session: 'Đêm nhạc Mùa Thu (Đêm 1)',
      gross: '14.200.000đ',
      fee: '1.420.000đ',
      net: '12.780.000đ',
      status: 'Đã quyết toán',
    },
    {
      id: 'STL-02',
      session: 'Đêm nhạc Mùa Thu (Đêm 2)',
      gross: '9.200.000đ',
      fee: '920.000đ',
      net: '8.280.000đ',
      status: 'Chờ đối soát sau show',
    },
  ];

  // Filter payouts requested by this organizer
  const orgPayouts = payouts.filter((p) => p.organizer.includes('Ánh Trăng'));

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <span className="tag-overline">TÀI CHÍNH & ĐỐI SOÁT</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '32px',
              fontWeight: 700,
              color: 'var(--text)',
              margin: 0,
            }}
          >
            Doanh thu & Số dư chi trả
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--muted)' }}>
            Theo dõi dòng tiền bán vé thực tế, khấu trừ phí nền tảng và tạo lệnh rút tiền về tài khoản ngân hàng doanh nghiệp.
          </p>
        </div>

        <button
          onClick={() => setShowPayoutModal(true)}
          className="btn btn-primary"
        >
          <ArrowUpRight size={18} />
          <span>Yêu cầu chi trả (Payout)</span>
        </button>
      </div>

      {toastMessage && (
        <div
          style={{
            padding: '12px 18px',
            backgroundColor: 'var(--success-bg)',
            color: 'var(--success)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Finance Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
          marginBottom: '32px',
        }}
      >
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
            Tổng doanh thu ghi nhận
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '34px',
              fontWeight: 700,
              color: 'var(--text)',
              marginBottom: '10px',
            }}
          >
            23.400.000đ
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Từ 2 suất diễn đang bán</div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
            Số dư khả dụng để rút
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '34px',
              fontWeight: 700,
              color: 'var(--primary)',
              marginBottom: '10px',
            }}
          >
            21.060.000đ
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Đã khấu trừ 10% phí nền tảng Tickey</div>
        </div>

        <div className="card" style={{ padding: '24px' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
            Tài khoản ngân hàng thụ hưởng
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0' }}>
            <Building2 size={20} color="var(--primary)" />
            <strong style={{ fontSize: '16px' }}>Vietcombank · CN Tân Định</strong>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
            STK: <strong>0123456789</strong> (CÔNG TY CP ÁNH TRĂNG)
          </div>
        </div>
      </div>

      {/* Payout Requests History */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '32px' }}>
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet size={18} color="var(--primary)" />
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 700,
                margin: 0,
              }}
            >
              Lịch sử lệnh yêu cầu chi trả ({orgPayouts.length})
            </h3>
          </div>
          <button
            onClick={() => setShowPayoutModal(true)}
            className="btn btn-outline"
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            + Tạo yêu cầu mới
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Mã lệnh
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Thời gian tạo
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Nội dung yêu cầu
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Tài khoản nhận
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Số tiền thực nhận
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Trạng thái duyệt
              </th>
            </tr>
          </thead>
          <tbody>
            {orgPayouts.map((po) => (
              <tr key={po.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)', fontFamily: 'monospace' }}>
                  {po.id}
                </td>
                <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--muted)' }}>
                  {po.createdAt || 'Hôm nay'}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{po.eventName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Gốc: {po.grossAmount} (Phí: {po.feeAmount})</div>
                </td>
                <td style={{ padding: '16px 24px', fontSize: '13px', color: 'var(--text)' }}>
                  {po.bankInfo}
                </td>
                <td style={{ padding: '16px 24px', fontSize: '15px', fontWeight: 700, color: 'var(--primary)' }}>
                  {po.netPayout}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  {po.status === 'PENDING_FIRST' && (
                    <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> Chờ Admin duyệt 1
                    </span>
                  )}
                  {po.status === 'PENDING_SECOND' && (
                    <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} /> Cần Admin duyệt 2
                    </span>
                  )}
                  {po.status === 'COMPLETED' && (
                    <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle size={12} /> Đã giải ngân
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Settlements Table Card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '18px',
              fontWeight: 700,
              margin: 0,
            }}
          >
            Đối soát theo từng suất diễn
          </h3>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg)' }}>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Mã đối soát
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Suất diễn
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Doanh thu gộp
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Phí nền tảng
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Thực nhận (Net)
              </th>
              <th style={{ padding: '14px 24px', fontSize: '12px', color: 'var(--muted)', fontWeight: 600 }}>
                Trạng thái
              </th>
            </tr>
          </thead>
          <tbody>
            {settlements.map((set) => (
              <tr key={set.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '16px 24px', fontSize: '13px', fontWeight: 700, color: 'var(--primary)' }}>
                  {set.id}
                </td>
                <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 600 }}>
                  {set.session}
                </td>
                <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--text)' }}>
                  {set.gross}
                </td>
                <td style={{ padding: '16px 24px', fontSize: '14px', color: 'var(--muted)' }}>
                  {set.fee}
                </td>
                <td style={{ padding: '16px 24px', fontSize: '14px', fontWeight: 700, color: 'var(--success)' }}>
                  {set.net}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className={`badge ${set.status === 'Đã quyết toán' ? 'badge-success' : 'badge-warning'}`}>
                    {set.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payout Request Modal */}
      {showPayoutModal && (
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
              maxWidth: '520px',
              backgroundColor: 'var(--surface)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowUpRight size={22} color="var(--primary)" />
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '20px',
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  Yêu cầu chi trả doanh thu (Payout)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="btn-ghost"
                style={{ border: 'none', background: 'none', fontSize: '18px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '13px', marginBottom: '20px' }}>
              Lệnh chi trả sẽ được chuyển sang hàng đợi kiểm soát 2 người duyệt của Admin Tickey trước khi chuyển khoản.
            </p>

            <form onSubmit={handlePayoutSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ backgroundColor: 'var(--bg)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Số dư khả dụng hiện tại:</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>
                  21.060.000 VNĐ
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Số tiền yêu cầu chi trả (VNĐ) *
                </label>
                <input
                  type="number"
                  min={1000000}
                  max={21060000}
                  step={100000}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  required
                  style={{ width: '100%', height: '40px', padding: '0 12px', fontSize: '15px', fontWeight: 600 }}
                />
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
                  Phí nền tảng tạm tính 3.5%: {(Math.round(payoutAmount * 0.035)).toLocaleString('vi-VN')} VNĐ. Thực nhận: {(payoutAmount - Math.round(payoutAmount * 0.035)).toLocaleString('vi-VN')} VNĐ.
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Ngân hàng thụ hưởng
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                >
                  <option value="Vietcombank - CN Tân Định">Vietcombank - CN Tân Định</option>
                  <option value="Techcombank - CN Sài Gòn">Techcombank - CN Sài Gòn</option>
                  <option value="MB Bank - CN Hội Sở">MB Bank - CN Hội Sở</option>
                  <option value="ACB - CN Bến Thành">ACB - CN Bến Thành</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Số tài khoản *
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    style={{ width: '100%', height: '40px', padding: '0 12px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                    Chủ tài khoản *
                  </label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    required
                    style={{ width: '100%', height: '40px', padding: '0 12px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                  Nội dung chuyển khoản / Ghi chú
                </label>
                <input
                  type="text"
                  value={payoutNote}
                  onChange={(e) => setPayoutNote(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px' }}
                />
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '12px',
                  marginTop: '12px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="btn btn-outline"
                >
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary">
                  Gửi yêu cầu chi trả
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
