import { isCompleteOtp } from '../../components/otp-input-state';

export type AuthMode = 'login' | 'register' | 'forgot' | 'reset' | 'verify' | 'verify-recovery';
export function validateAuthForm(
  mode: AuthMode,
  form: { email: string; password: string; confirm: string; name: string; token: string },
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = 'Nhập email hợp lệ.';
  if (mode === 'register' && !form.name.trim()) errors.name = 'Nhập họ và tên.';
  if (mode === 'login' && !form.password) errors.password = 'Nhập mật khẩu.';
  if ((mode === 'register' || mode === 'reset') && form.password.length < 8)
    errors.password = 'Mật khẩu cần ít nhất 8 ký tự.';
  if (mode === 'reset' && form.password !== form.confirm) errors.confirm = 'Hai mật khẩu chưa khớp.';
  if ((mode === 'verify' || mode === 'verify-recovery') && !isCompleteOtp(form.token))
    errors.token = 'Nhập đủ mã xác nhận 8 số trong email.';
  return errors;
}
