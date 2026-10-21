import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { TickeyLogo } from '../../components/common/TickeyLogo';

export type AuthFlowScreen =
  | 'w-mfa'
  | 'w-mfa-setup'
  | 'w-mfa-admin'
  | 'w-verify'
  | 'w-forgot'
  | 'w-reset';

const FLOW_TABS: Array<{ id: AuthFlowScreen; path: string; label: string; nodeId: string }> = [
  { id: 'w-mfa', path: '/mfa', label: '2FA (w-mfa)', nodeId: '1:4698' },
  { id: 'w-mfa-setup', path: '/mfa-setup', label: 'Thiết lập 2FA (w-mfa-setup)', nodeId: '1:4726' },
  { id: 'w-mfa-admin', path: '/mfa-admin', label: '2FA Admin (w-mfa-admin)', nodeId: '1:16827' },
  { id: 'w-verify', path: '/verify', label: 'Xác minh email (w-verify)', nodeId: '17:7451' },
  { id: 'w-forgot', path: '/forgot-password', label: 'Quên mật khẩu (w-forgot)', nodeId: '17:7477' },
  { id: 'w-reset', path: '/reset-password', label: 'Đặt lại mật khẩu (w-reset)', nodeId: '17:7501' },
];

export function AuthFlowsPage({ defaultScreen }: { defaultScreen?: AuthFlowScreen }) {
  const location = useLocation();
  const navigate = useNavigate();

  const resolvedScreen: AuthFlowScreen =
    defaultScreen ??
    (FLOW_TABS.find((t) => location.pathname === t.path)?.id || 'w-mfa');

  const [otp, setOtp] = useState('482910');
  const [email, setEmail] = useState('owner@anhtrang.vn');
  const [newPassword, setNewPassword] = useState('••••••••••••');
  const [confirmPassword, setConfirmPassword] = useState('••••••••••••');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [notice, setNotice] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (resolvedScreen === 'w-mfa' || resolvedScreen === 'w-mfa-setup') {
      navigate('/workspaces');
    } else if (resolvedScreen === 'w-mfa-admin') {
      navigate('/admin');
    } else if (resolvedScreen === 'w-verify') {
      navigate('/workspaces');
    } else if (resolvedScreen === 'w-forgot') {
      navigate('/reset-password');
    } else if (resolvedScreen === 'w-reset') {
      navigate('/login');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 24px 64px',
      }}
    >
      {/* Top Figma Frame Switcher Bar for Section 00 */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '980px',
          padding: '12px 18px',
          marginBottom: '32px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        <span className="tag-overline" style={{ marginBottom: 0 }}>
          00 / ĐĂNG NHẬP CHUNG · Web
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          <Link to="/login" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
            Đăng nhập (w-login)
          </Link>
          <Link to="/register" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
            Đăng ký (w-register)
          </Link>
          <Link to="/workspaces" className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>
            Workspace (w-workspace)
          </Link>
          {FLOW_TABS.map((tab) => (
            <Link
              key={tab.id}
              to={tab.path}
              className={`btn ${resolvedScreen === tab.id ? 'btn-primary' : 'btn-outline'}`}
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Main Centered Figma Frame Card */}
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '36px 40px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <TickeyLogo size="md" />
          <span className="tag-overline" style={{ marginBottom: 0 }}>
            TICKEY / WEB AUTH
          </span>
        </div>

        {notice && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '20px',
            }}
          >
            {notice}
          </div>
        )}

        {/* 1:4698 | w-mfa / Xác thực hai bước */}
        {resolvedScreen === 'w-mfa' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ fontSize: '28px', marginBottom: '6px' }}>Xác thực hai bước</h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                Dùng cho tài khoản Admin hoặc thao tác nhạy cảm
              </p>
            </div>

            <label>
              {useBackupCode ? 'Mã dự phòng 8 chữ số' : 'Mã xác thực'}
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder={
                  useBackupCode
                    ? 'Nhập mã dự phòng (VD: 1842-9910)'
                    : 'Nhập mã 6 chữ số từ ứng dụng xác thực'
                }
                style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.12em' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}>
                Nhập mã 6 chữ số từ ứng dụng xác thực
              </span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Xác nhận
              </button>
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode((v) => !v);
                  setOtp(useBackupCode ? '482910' : '1842-9910');
                }}
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Dùng mã dự phòng
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', paddingTop: '6px' }}>
              <Link to="/mfa-setup">Thiết lập ứng dụng 2FA mới</Link>
              <Link to="/login" style={{ color: 'var(--muted)' }}>
                Quay lại đăng nhập
              </Link>
            </div>
          </form>
        )}

        {/* 1:4726 | w-mfa-setup / Thiết lập 2FA */}
        {resolvedScreen === 'w-mfa-setup' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ fontSize: '28px', marginBottom: '6px' }}>Thiết lập xác thực hai bước</h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                Quét mã trên ứng dụng xác thực
              </p>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                padding: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '18px',
              }}
            >
              <div
                style={{
                  width: '104px',
                  height: '104px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  padding: '10px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gridTemplateRows: 'repeat(5, 1fr)',
                  gap: '3px',
                  flexShrink: 0,
                }}
              >
                {Array.from({ length: 25 }).map((_, idx) => (
                  <div
                    key={idx}
                    style={{
                      borderRadius: '2px',
                      backgroundColor: [0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 19, 20, 22, 24].includes(idx)
                        ? 'var(--navy)'
                        : '#E7E4DF',
                    }}
                  />
                ))}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Khóa thiết lập
                </div>
                <div style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)', marginTop: '2px' }}>
                  JBSWY3DPEHPK3PXP
                </div>
                <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '10px 0' }} />
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
                  Mã dự phòng
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text)', marginTop: '2px' }}>
                  1842-9910 • 7731-4402
                </div>
              </div>
            </div>

            <label>
              Mã xác nhận đầu tiên
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập mã 6 chữ số"
                style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.12em' }}
              />
            </label>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              Bật xác thực hai bước
            </button>
          </form>
        )}

        {/* 1:16827 | w-mfa-admin / Xác thực hai bước trước khi vào Admin */}
        {resolvedScreen === 'w-mfa-admin' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <span className="badge badge-info" style={{ marginBottom: '10px' }}>
                BẢO MẬT QUẢN TRỊ NỀN TẢNG
              </span>
              <h1 style={{ fontSize: '28px', marginBottom: '6px' }}>Xác thực hai bước</h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                Dùng cho tài khoản Admin hoặc thao tác nhạy cảm
              </p>
            </div>

            <label>
              Mã xác thực
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập mã 6 chữ số từ ứng dụng xác thực"
                style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.12em' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}>
                Nhập mã 6 chữ số từ ứng dụng xác thực
              </span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Xác nhận và vào Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtp('7731-4402');
                  setNotice('Đã chuyển sang chế độ nhập mã dự phòng Admin.');
                }}
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Dùng mã dự phòng
              </button>
            </div>
          </form>
        )}

        {/* 17:7451 | w-verify / Xác minh email */}
        {resolvedScreen === 'w-verify' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ fontSize: '28px', marginBottom: '6px' }}>Xác minh email</h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                Đã gửi mã 6 chữ số tới email đã đăng ký
              </p>
            </div>

            <label>
              Mã xác minh
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập mã 6 chữ số"
                style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.12em' }}
              />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Xác minh và tiếp tục
              </button>
              <button
                type="button"
                onClick={() => setNotice('Đã gửi lại mã xác minh 6 chữ số tới email của bạn.')}
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Gửi lại mã
              </button>
            </div>
          </form>
        )}

        {/* 17:7477 | w-forgot / Quên mật khẩu */}
        {resolvedScreen === 'w-forgot' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ fontSize: '28px', marginBottom: '6px' }}>Quên mật khẩu</h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                Nhập email đã đăng ký để nhận hướng dẫn đặt lại mật khẩu
              </p>
            </div>

            <label>
              Email công việc
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Nhập email công việc"
              />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Gửi mã khôi phục
              </button>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn btn-outline"
                style={{ width: '100%' }}
              >
                Quay lại đăng nhập
              </button>
            </div>
          </form>
        )}

        {/* 17:7501 | w-reset / Đặt lại mật khẩu */}
        {resolvedScreen === 'w-reset' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <h1 style={{ fontSize: '28px', marginBottom: '6px' }}>Đặt lại mật khẩu</h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                Nhập mã xác nhận đã gửi qua email và mật khẩu mới
              </p>
            </div>

            <label>
              Mã xác nhận 6 chữ số
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={{ fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.12em' }}
              />
            </label>

            <label>
              Mật khẩu mới
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>

            <label>
              Nhập lại mật khẩu mới
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '6px' }}>
              Cập nhật mật khẩu
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
