import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { TickeyLogo } from '../../components/common/TickeyLogo';
import { supabase } from '../../lib/supabase';

export function LoginPage() {
  const navigate = useNavigate();
  // Seed account (supabase/seed.sql) prefilled for local development only.
  const [email, setEmail] = useState(import.meta.env.DEV ? 'owner-a@dev.local' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'Dev@123456' : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        const message = signInError.message.toLowerCase();
        setError(
          message.includes('invalid')
            ? 'Email hoặc mật khẩu chưa đúng.'
            : message.includes('not confirmed')
              ? 'Email chưa được xác minh. Nhập mã đã gửi tới email để kích hoạt.'
              : message.includes('fetch') || message.includes('network')
                ? 'Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.'
                : 'Không thể đăng nhập lúc này. Vui lòng thử lại.',
        );
        return;
      }
      // A user with 2FA must enter the TOTP code before any Owner / Finance / Admin workspace.
      const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      navigate(level?.nextLevel === 'aal2' && level.currentLevel !== 'aal2' ? '/mfa' : '/workspaces');
    } catch {
      setError('Không thể kết nối máy chủ. Kiểm tra mạng và thử lại.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--bg)',
      }}
    >
      {/* Left Banner Section (Concert Photography) */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          backgroundImage: `linear-gradient(180deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0.75) 100%), url('/assets/9c7be2acbe8f7bdd910d9d1826c52f35aa38986e.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: '#FFFFFF',
          minHeight: '100vh',
        }}
        className="auth-banner"
      >
        <div>
          <TickeyLogo size="md" variant="dark" />
        </div>

        <div style={{ maxWidth: '480px', marginBottom: '24px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '40px',
              fontWeight: 700,
              lineHeight: 1.15,
              color: '#FFFFFF',
              marginBottom: '16px',
            }}
          >
            Mang khán giả <br />
            đến gần sân khấu.
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '16px',
              color: 'rgba(255, 255, 255, 0.85)',
              margin: 0,
            }}
          >
            Một không gian cho mọi sự kiện.
          </p>
        </div>
      </div>

      {/* Right Form Section */}
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 64px',
          backgroundColor: 'var(--bg)',
        }}
      >
        <div style={{ margin: 'auto 0', maxWidth: '420px', width: '100%' }}>
          <div style={{ marginBottom: '32px' }}>
            <span className="tag-overline">TICKEY</span>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '32px',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '8px',
              }}
            >
              Đăng nhập Tickey
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--muted)',
                margin: 0,
              }}
            >
              Đăng nhập để truy cập Tickey.
            </p>
          </div>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@organization.vn"
                required
                autoComplete="email"
              />
            </label>

            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </label>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  fontSize: '13px',
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy}
              style={{ width: '100%', padding: '13px', marginTop: '6px' }}
            >
              {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '13px',
                fontWeight: 600,
                marginTop: '4px',
              }}
            >
              <Link to="/forgot-password" style={{ color: 'var(--primary)' }}>
                Quên mật khẩu?
              </Link>
              <Link to="/register" style={{ color: 'var(--primary)' }}>
                Đăng ký tài khoản
              </Link>
            </div>

            {/* 1-click Quick access during dev/demo */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginBottom: 8 }}>
                Hoặc truy cập nhanh không cần mật khẩu:
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: 12.5, padding: '9px 10px', justifyContent: 'center', fontWeight: 600 }}
                  onClick={() => navigate('/org')}
                >
                  🏢 Ban tổ chức (Org)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: 12.5, padding: '9px 10px', justifyContent: 'center', fontWeight: 600 }}
                  onClick={() => navigate('/admin')}
                >
                  🛡️ Quản trị viên (Admin)
                </button>
              </div>
            </div>
          </form>

          {/* Quick local dev hint */}
          <div
            style={{
              marginTop: '32px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--surface-alt)',
              border: '1px dashed var(--border)',
              fontSize: '12px',
              color: 'var(--muted)',
            }}
          >
            <strong>Tài khoản seed mẫu:</strong>
            <br />
            • <code>owner-a@dev.local</code> / <code>Dev@123456</code> (Owner Ánh Trăng)
            <br />
            • <code>admin-a@dev.local</code> / <code>Dev@123456</code> (Admin nền tảng)
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed var(--border)', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <Link to="/mfa">2FA (w-mfa)</Link>
              <span>•</span>
              <Link to="/mfa-setup">Thiết lập 2FA (w-mfa-setup)</Link>
              <span>•</span>
              <Link to="/mfa-admin">2FA Admin (w-mfa-admin)</Link>
              <span>•</span>
              <Link to="/verify">Xác minh email (w-verify)</Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ paddingTop: '24px' }}>
          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: 0 }}>
            © 2026 Tickey · Dành cho nhà tổ chức và quản trị viên
          </p>
        </div>
      </div>
    </div>
  );
}
