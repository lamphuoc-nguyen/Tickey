import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Search } from 'lucide-react';
import { useMockStore } from '../../lib/mock-store';
import { useToast } from '../../components/common/ToastProvider';
import {
  FigmaPageHeader,
  FigmaNavyContextBanner,
  FigmaContextGrid,
  FigmaRecordInfoCard,
  type FigmaScreenOption,
} from '../../components/common/FigmaScreenPrimitives';

const FINANCE_SCREENS: FigmaScreenOption[] = [
  { id: 'o-finance', label: 'Tổng quan tài chính' },
  { id: 'o-settlements', label: 'Kỳ đối soát doanh thu' },
  { id: 'o-payouts', label: 'Lệnh chi trả (Payouts)' },
  { id: 'o-bank', label: 'Tài khoản ngân hàng nhận tiền' },
  { id: 'o-bank-mfa', label: 'Xác thực 2FA đổi ngân hàng' },
  { id: 'o-bank-pending', label: 'Yêu cầu ngân hàng chờ duyệt' },
];

export function OrgFinancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { state, requestBankChange, requestPayout } = useMockStore();
  const { showToast } = useToast();

  const activeScreen = searchParams.get('screen') || 'o-finance';
  const setScreen = (screen: string) => setSearchParams({ screen });

  const [search, setSearch] = useState('');
  const [bankName, setBankName] = useState(state.orgBank.bankName || 'Vietcombank · CN TP.HCM');
  const [accountNumber, setAccountNumber] = useState(state.orgBank.accountNumber || '0071001234567');
  const [accountHolder, setAccountHolder] = useState(
    state.orgBank.accountHolder || 'CONG TY TNHH ANH TRANG EVENTS',
  );
  const [otpCode, setOtpCode] = useState('482910');

  const screenMeta = FINANCE_SCREENS.find((s) => s.id === activeScreen) || FINANCE_SCREENS[0];

  return (
    <div>
      <FigmaPageHeader
        overline="TICKEY / ORGANIZATION"
        title={screenMeta.label}
        screens={FINANCE_SCREENS}
        activeScreen={activeScreen}
        onSelectScreen={setScreen}
      />

      {/* 1. o-finance */}
      {activeScreen === 'o-finance' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
            {[
              { label: 'Tổng doanh thu gộp', value: '128.400.000đ', note: '214 vé đã thanh toán' },
              { label: 'Phí nền tảng (5%)', value: '6.420.000đ', note: 'Theo hợp đồng đối tác' },
              { label: 'Quỹ dự phòng hoàn/tranh chấp', value: '12.840.000đ', note: 'Tạm giữ 10% đến sau sự kiện' },
              { label: 'Số dư khả dụng chi trả', value: '109.140.000đ', note: 'Kỳ đối soát T+3' },
            ].map((k) => (
              <div key={k.label} className="card" style={{ padding: 18 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{k.label}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
                  {k.value}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{k.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-settlements')}
            >
              Xem kỳ đối soát
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-payouts')}
            >
              Lệnh chi trả
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-bank')}
            >
              Tài khoản ngân hàng
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
                Biến động doanh thu theo sự kiện
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>2 bản ghi</div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>SỰ KIỆN</th>
                    <th>DOANH THU GỘP</th>
                    <th>PHÍ NỀN TẢNG</th>
                    <th>THỰC NHẬN DỰ KIẾN</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Đêm nhạc Mùa Thu · Đêm 1</td>
                    <td>72.400.000đ</td>
                    <td>3.620.000đ</td>
                    <td>68.780.000đ</td>
                    <td>
                      <span className="badge badge-success">Đang tích lũy</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('o-settlements')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Đối soát →
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>Đêm nhạc Mùa Thu · Đêm 2</td>
                    <td>56.000.000đ</td>
                    <td>2.800.000đ</td>
                    <td>53.200.000đ</td>
                    <td>
                      <span className="badge badge-success">Đang tích lũy</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('o-settlements')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Đối soát →
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. o-settlements */}
      {activeScreen === 'o-settlements' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
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
                placeholder="Tìm theo mã kỳ đối soát..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setScreen('o-payouts')}
              >
                Lệnh chi trả
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => showToast('Đã tải xuống biên bản đối soát PDF.', 'success')}
              >
                Xuất biên bản
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
                Tất cả danh sách kỳ đối soát
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>2 bản ghi</div>
            </div>
            <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>MÃ KỲ</th>
                    <th>CHU KỲ</th>
                    <th>DOANH THU RÒNG</th>
                    <th>TRẠNG THÁI</th>
                    <th>THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 700 }}>STL-2026-10A</td>
                    <td>01/10 – 15/10/2026</td>
                    <td>64.200.000đ</td>
                    <td>
                      <span className="badge badge-success">Đã chốt sổ</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('o-payouts')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Xem chi trả →
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 700 }}>STL-2026-10B</td>
                    <td>16/10 – 31/10/2026</td>
                    <td>44.940.000đ</td>
                    <td>
                      <span className="badge badge-warning">Đang tạm tính</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => setScreen('o-finance')}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. o-payouts */}
      {activeScreen === 'o-payouts' && (
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
              Lịch sử lệnh chi trả về tài khoản tổ chức
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  const res = requestPayout({
                    amount: 64200000,
                    bankName: state.orgBank.bankName,
                    accountNumber: state.orgBank.accountNumber,
                    accountHolder: state.orgBank.accountHolder,
                    organizer: state.orgOnboarding.orgName,
                    eventName: 'Đêm nhạc Mùa Thu',
                  });
                  showToast(`Đã gửi yêu cầu quyết toán ${res.id} (64.200.000đ) tới Admin.`, 'success');
                }}
              >
                + Yêu cầu quyết toán mới
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setScreen('o-bank')}
              >
                Cập nhật ngân hàng nhận
              </button>
            </div>
          </div>
          <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>MÃ CHI TRẢ</th>
                  <th>KỲ ĐỐI SOÁT</th>
                  <th>NGÂN HÀNG NHẬN</th>
                  <th>SỐ TIỀN</th>
                  <th>TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                {(state?.adminPayouts || []).map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.code}</td>
                    <td>{p.settlementCode}</td>
                    <td>{state.orgBank.bankName} (*{state.orgBank.accountNumber.slice(-4)})</td>
                    <td>{p.amount}</td>
                    <td>
                      <span
                        className={`badge ${
                          p.status === 'PAID'
                            ? 'badge-success'
                            : p.status === 'CANCELLED'
                              ? 'badge-danger'
                              : 'badge-warning'
                        }`}
                      >
                        {p.status === 'PAID'
                          ? 'Đã chuyển khoản'
                          : p.status === 'CANCELLED'
                            ? 'Đã từ chối'
                            : 'Chờ Admin giải ngân'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. o-bank */}
      {activeScreen === 'o-bank' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Thông tin chi tiết · Tài khoản ngân hàng
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Ngân hàng & Chi nhánh</label>
                <input
                  className="form-input"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Số tài khoản doanh nghiệp</label>
                <input
                  className="form-input"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Tên chủ tài khoản (Trùng tên pháp nhân KYC)</label>
                <input
                  className="form-input"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setScreen('o-bank-mfa')}
                >
                  Tiếp tục xác thực 2FA
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-finance')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard />
        </div>
      )}

      {/* 5. o-bank-mfa */}
      {activeScreen === 'o-bank-mfa' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.85fr 1fr', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15.5, fontWeight: 700, marginBottom: 16 }}>
              Xác thực bảo mật 2 lớp (2FA / OTP)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="form-label">Tài khoản nhận mới</label>
                <input
                  className="form-input"
                  readOnly
                  value={`${bankName} · ${accountNumber}`}
                />
              </div>
              <div>
                <label className="form-label">Mã OTP gửi tới email Owner (ops@anhtrangevents.vn)</label>
                <input
                  className="form-input"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    requestBankChange(bankName, accountNumber, accountHolder);
                    showToast('Đã xác thực OTP và gửi yêu cầu đổi ngân hàng tới Admin.', 'success');
                    setScreen('o-bank-pending');
                  }}
                >
                  Xác nhận & gửi duyệt
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setScreen('o-bank')}
                >
                  Quay lại
                </button>
              </div>
            </div>
          </div>
          <FigmaRecordInfoCard icon="shield" />
        </div>
      )}

      {/* 6. o-bank-pending */}
      {activeScreen === 'o-bank-pending' && (
        <div>
          <FigmaNavyContextBanner
            title="Ánh Trăng Events"
            subtitle="Hồ sơ đang xem · Đúng tổ chức và phạm vi xử lý"
            badge="Chờ xác minh ngân hàng"
          />
          <FigmaContextGrid
            items={[
              { label: 'Ngân hàng đề xuất', value: bankName },
              { label: 'Số tài khoản & Chủ TK', value: `${accountNumber} · ${accountHolder}` },
              { label: 'Xác thực 2FA', value: 'Đã xác thực OTP bởi Owner · 21/10/2026' },
              { label: 'Trạng thái xử lý', value: 'Đang chờ Admin đối chiếu tên pháp nhân KYC' },
            ]}
          />
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setScreen('o-finance')}
            >
              Về tổng quan tài chính
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setScreen('o-payouts')}
            >
              Xem lệnh chi trả
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
