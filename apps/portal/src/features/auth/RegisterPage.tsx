import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { TickeyLogo } from '../../components/common/TickeyLogo';
import { supabase } from '../../lib/supabase';

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);

    if (password.length < 8) {
      setError('Mật khẩu phải có tối thiểu 8 ký tự');
      setBusy(false);
      return;
    }

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: fullName,
        },
      },
    });

    setBusy(false);
    if (signUpError) {
      navigate('/verify');
    } else {
      setSuccess(true);
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
      {/* Left Banner Section */}
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
            <span className="tag-overline">TICKEY WORKSPACE</span>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '32px',
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: '8px',
              }}
            >
              Tạo tài khoản Tickey
            </h1>
          </div>

          {success ? (
            <div
              style={{
                padding: '24px',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--success-bg)',
                  color: 'var(--success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: '24px',
                }}
              >
                ✓
              </div>
              <h3 style={{ marginBottom: '8px' }}>Kiểm tra hòm thư của bạn</h3>
              <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
                Chúng tôi đã gửi liên kết xác nhận tài khoản tới <strong>{email}</strong>. Vui lòng xác thực email để tiếp tục.
              </p>
              <button onClick={() => navigate('/login')} className="btn btn-primary" style={{ width: '100%' }}>
                Quay lại đăng nhập
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <label>
                Họ tên
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tên của bạn"
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
                  placeholder="Tối thiểu 8 ký tự"
                  required
                  autoComplete="new-password"
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
                {busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '13px', marginTop: '4px' }}>
                <span style={{ color: 'var(--muted)' }}>Đã có tài khoản? </span>
                <Link to="/login" style={{ fontWeight: 600 }}>
                  Đăng nhập
                </Link>
              </div>
            </form>
          )}
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
