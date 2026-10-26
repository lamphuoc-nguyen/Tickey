import { ApiError } from '@event/core';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { TickeyLogo } from '../../components/common/TickeyLogo';
import { errorMessage } from '../../lib/api';
import { repositories } from '../../lib/repositories';
import { supabase } from '../../lib/supabase';

export type AuthFlowScreen = 'w-verify' | 'w-forgot' | 'w-reset';

const FLOW_TABS: Array<{ id: AuthFlowScreen; path: string; label: string; nodeId: string }> = [
  { id: 'w-verify', path: '/verify', label: 'Xác minh email (w-verify)', nodeId: '17:7451' },
  { id: 'w-forgot', path: '/forgot-password', label: 'Quên mật khẩu (w-forgot)', nodeId: '17:7477' },
  { id: 'w-reset', path: '/reset-password', label: 'Đặt lại mật khẩu (w-reset)', nodeId: '17:7501' },
];

const codeInput = { fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.12em' } as const;

// Supabase Auth errors are plain objects/Errors, not ApiError; give them readable text.
function authMessage(error: unknown): string {
  if (error instanceof ApiError) return errorMessage(error);
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid.*code|expired|otp/i.test(message))
    return 'Mã không đúng hoặc đã hết hạn. Vui lòng thử lại.';
  if (/rate limit|too many/i.test(message))
    return 'Bạn thao tác quá nhanh. Vui lòng chờ một chút rồi thử lại.';
  if (/password/i.test(message)) return 'Mật khẩu chưa đạt yêu cầu (tối thiểu 8 ký tự).';
  return 'Không thể hoàn tất. Vui lòng thử lại.';
}

export function AuthFlowsPage({ defaultScreen }: { defaultScreen?: AuthFlowScreen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const passedEmail = (location.state as { email?: string } | null)?.email ?? '';

  const resolvedScreen: AuthFlowScreen =
    defaultScreen ?? (FLOW_TABS.find((t) => location.pathname === t.path)?.id || 'w-verify');

  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState(passedEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
    } catch (failure) {
      setError(authMessage(failure));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (resolvedScreen === 'w-verify') {
        await repositories.auth.verifyOtp(email, otp, 'signup');
        navigate('/workspaces');
      } else if (resolvedScreen === 'w-forgot') {
        await repositories.auth.forgotPassword(email, `${window.location.origin}/reset-password`);
        navigate('/reset-password', { state: { email } });
      } else if (resolvedScreen === 'w-reset') {
        if (newPassword !== confirmPassword) {
          setError('Hai mật khẩu chưa trùng khớp.');
          return;
        }
        await repositories.auth.verifyOtp(email, otp, 'recovery');
        await repositories.auth.resetPassword(newPassword);
        await supabase.auth.signOut();
        navigate('/login');
      }
    });
  };

  const resendSignup = () =>
    void run(async () => {
      await repositories.auth.resendSignup(email);
      setNotice('Đã gửi lại mã xác minh 6 chữ số tới email của bạn.');
    });

  const emailField = (
    <label>
      Email
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Nhập email"
        required
      />
    </label>
  );

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
      {/* Figma frame switcher: a design-review aid, local development only */}
      {import.meta.env.DEV && (
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
            <Link
              to="/register"
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              Đăng ký (w-register)
            </Link>
            <Link
              to="/workspaces"
              className="btn btn-outline"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
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
      )}

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

        {(notice || error) && (
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: error ? 'var(--danger-bg)' : 'var(--success-bg)',
              color: error ? 'var(--danger)' : 'var(--success)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '20px',
            }}
          >
            {error || notice}
          </div>
        )}

        {/* 17:7451 | w-verify / Xác minh email */}
        {resolvedScreen === 'w-verify' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h1 style={{ fontSize: '28px', marginBottom: '6px' }}>Xác minh email</h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                Nhập mã 6 chữ số đã gửi tới email đăng ký
              </p>
            </div>

            {emailField}

            <label>
              Mã xác minh
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập mã 6 chữ số"
                style={codeInput}
                required
              />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
                {busy ? 'Đang xác minh…' : 'Xác minh và tiếp tục'}
              </button>
              <button
                type="button"
                onClick={resendSignup}
                className="btn btn-outline"
                style={{ width: '100%' }}
                disabled={busy || !email}
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
                Nhập email đã đăng ký để nhận mã đặt lại mật khẩu
              </p>
            </div>

            {emailField}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
                {busy ? 'Đang gửi…' : 'Gửi mã khôi phục'}
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

            {emailField}

            <label>
              Mã xác nhận 6 chữ số
              <input
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                style={codeInput}
                required
              />
            </label>

            <label>
              Mật khẩu mới
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            <label>
              Nhập lại mật khẩu mới
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '6px' }}
              disabled={busy}
            >
              {busy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
