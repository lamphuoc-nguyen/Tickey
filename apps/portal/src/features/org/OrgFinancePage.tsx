import { ArrowUpRight, Building2 } from 'lucide-react';

export function OrgFinancePage() {
  const settlements = [
    {
      id: 'SET-01',
      session: 'Đêm nhạc Mùa Thu (Đêm 1)',
      gross: '16.200.000đ',
      fee: '1.620.000đ',
      net: '14.580.000đ',
      status: 'Đã quyết toán',
      payoutDate: '25/10/2026',
    },
    {
      id: 'SET-02',
      session: 'Đêm nhạc Mùa Thu (Đêm 2)',
      gross: '7.200.000đ',
      fee: '720.000đ',
      net: '6.480.000đ',
      status: 'Đang ghi nhận',
      payoutDate: '26/10/2026',
    },
  ];

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
        </div>

        <button
          onClick={() => alert('Gửi yêu cầu chi trả doanh thu về tài khoản ngân hàng (o-payouts)')}
          className="btn btn-primary"
        >
          <ArrowUpRight size={18} />
          <span>Yêu cầu chi trả (Payout)</span>
        </button>
      </div>

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
            Đối soát theo suất diễn
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
    </div>
  );
}
