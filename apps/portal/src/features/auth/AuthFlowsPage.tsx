import { ApiError } from '@event/core';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { TickeyLogo } from '../../components/common/TickeyLogo';
import { errorMessage } from '../../lib/api';
import { repositories } from '../../lib/repositories';
import { supabase } from '../../lib/supabase';

export type AuthFlowScreen = 'w-mfa' | 'w-mfa-setup' | 'w-mfa-admin' | 'w-verify' | 'w-forgot' | 'w-reset';

const FLOW_TABS: Array<{ id: AuthFlowScreen; path: string; label: string; nodeId: string }> = [
  { id: 'w-mfa', path: '/mfa', label: '2FA (w-mfa)', nodeId: '1:4698' },
  { id: 'w-mfa-setup', path: '/mfa-setup', label: 'Thiết lập 2FA (w-mfa-setup)', nodeId: '1:4726' },
  { id: 'w-mfa-admin', path: '/mfa-admin', label: '2FA Admin (w-mfa-admin)', nodeId: '1:16827' },
  { id: 'w-verify', path: '/verify', label: 'Xác minh email (w-verify)', nodeId: '17:7451' },
  { id: 'w-forgot', path: '/forgot-password', label: 'Quên mật khẩu (w-forgot)', nodeId: '17:7477' },
  { id: 'w-reset', path: '/reset-password', label: 'Đặt lại mật khẩu (w-reset)', nodeId: '17:7501' },
];

const codeInput = { fontFamily: 'monospace', fontSize: '16px', letterSpacing: '0.12em' } as const;

// Supabase Auth errors are plain objects/Errors, not ApiError; give them readable text.
function authMessage(error: unknown): string {
  if (error instanceof ApiError) return errorMessage(error);
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid.*(totp|code)|expired|otp/i.test(message))
    return 'Mã không đúng hoặc đã hết hạn. Vui lòng thử lại.';
  if (/rate limit|too many/i.test(message))
    return 'Bạn thao tác quá nhanh. Vui lòng chờ một chút rồi thử lại.';
  if (/password/i.test(message)) return 'Mật khẩu chưa đạt yêu cầu (tối thiểu 8 ký tự).';
  return 'Không thể hoàn tất. Vui lòng thử lại.';
}

interface Enrollment {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function AuthFlowsPage({ defaultScreen }: { defaultScreen?: AuthFlowScreen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const passedEmail = (location.state as { email?: string } | null)?.email ?? '';

  const resolvedScreen: AuthFlowScreen =
    defaultScreen ?? (FLOW_TABS.find((t) => location.pathname === t.path)?.id || 'w-mfa');

  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState(passedEmail);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);

  const isMfaChallenge = resolvedScreen === 'w-mfa' || resolvedScreen === 'w-mfa-admin';

  // 2FA challenge: the verified TOTP factor; none yet → set one up first.
  useEffect(() => {
    if (!isMfaChallenge) return;
    void supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (listError) {
        setError(authMessage(listError));
        return;
      }
      const totp = data.totp[0];
      if (totp) setFactorId(totp.id);
      else navigate('/mfa-setup', { replace: true });
    });
  }, [isMfaChallenge, navigate]);

  // 2FA setup: drop half-finished enrolments, then enrol a new TOTP factor and show its QR code.
  useEffect(() => {
    if (resolvedScreen !== 'w-mfa-setup') return;
    let cancelled = false;
    void (async () => {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) return setError(authMessage(listError));
      if (factors.totp.length) {
        if (!cancelled) setAlreadyEnrolled(true);
        return;
      }
      for (const factor of factors.all.filter((f) => f.factor_type === 'totp' && f.status === 'unverified')) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        // Unique: friendly names must not repeat, and a re-run effect may enrol twice.
        friendlyName: `Tickey ${new Date().toISOString()}`,
      });
      if (cancelled) return;
      if (enrollError) return setError(authMessage(enrollError));
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedScreen]);

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

  const verifyTotp = async (id: string) => {
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: id,
      code: otp.trim(),
    });
    if (verifyError) throw verifyError;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (isMfaChallenge) {
        if (!factorId) throw new Error('otp');
        await verifyTotp(factorId);
        navigate('/workspaces');
      } else if (resolvedScreen === 'w-mfa-setup') {
        if (alreadyEnrolled) return navigate('/mfa');
        if (!enrollment) return;
        await verifyTotp(enrollment.factorId);
        navigate('/workspaces');
      } else if (resolvedScreen === 'w-verify') {
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

        {/* 1:4698 | w-mfa  ·  1:16827 | w-mfa-admin / Xác thực hai bước */}
        {isMfaChallenge && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              {resolvedScreen === 'w-mfa-admin' && (
                <span className="badge badge-info" style={{ marginBottom: '10px' }}>
                  BẢO MẬT QUẢN TRỊ NỀN TẢNG
                </span>
              )}
              <h1 style={{ fontSize: '28px', marginBottom: '6px' }}>Xác thực hai bước</h1>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--muted)' }}>
                Bắt buộc với Chủ tổ chức, Kế toán và Admin nền tảng
              </p>
            </div>

            <label>
              Mã xác thực
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Nhập mã 6 chữ số từ ứng dụng xác thực"
                style={codeInput}
                required
              />
            </label>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={busy || !factorId}
            >
              {busy ? 'Đang xác minh…' : 'Xác nhận'}
            </button>

            {import.meta.env.DEV && (
              <button
                type="button"
                className="btn btn-outline"
                style={{
                  width: '100%',
                  borderColor: '#3B82F6',
                  color: '#2563EB',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onClick={() => navigate('/workspaces')}
              >
                ⚡ Bỏ qua 2FA (Chế độ Dev) → Vào thẳng Workspace
              </button>
            )}

            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
              Mất ứng dụng xác thực? Liên hệ quản trị nền tảng để gỡ 2FA cũ, rồi thiết lập lại.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '13px' }}>
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
                {alreadyEnrolled
                  ? 'Tài khoản đã bật xác thực hai bước.'
                  : 'Quét mã bằng Google Authenticator, Microsoft Authenticator hoặc ứng dụng tương tự'}
              </p>
            </div>

            {!alreadyEnrolled && (
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
                    width: '132px',
                    height: '132px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    padding: '6px',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  {enrollment ? (
                    <img
                      src={enrollment.qrCode}
                      alt="Mã QR thiết lập 2FA"
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    'Đang tạo mã…'
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    Khóa thiết lập (nhập tay nếu không quét được)
                  </div>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      color: 'var(--primary)',
                      marginTop: '2px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {enrollment?.secret ?? '…'}
                  </div>
                </div>
              </div>
            )}

            {!alreadyEnrolled && (
              <label>
                Mã xác nhận đầu tiên
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Nhập mã 6 chữ số"
                  style={codeInput}
                  required
                />
              </label>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={busy || (!alreadyEnrolled && !enrollment)}
            >
              {alreadyEnrolled ? 'Xác thực để tiếp tục' : busy ? 'Đang bật…' : 'Bật xác thực hai bước'}
            </button>
          </form>
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
