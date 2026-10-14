export function configurationError(): string | null {
  const variables = {
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  };
  const missing = Object.entries(variables)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length)
    return 'Ứng dụng thiếu cấu hình kết nối dữ liệu hoặc tài khoản. Vui lòng liên hệ người quản trị để hoàn tất cấu hình.';
  try {
    const urls = [new URL(variables.EXPO_PUBLIC_SUPABASE_URL!), new URL(variables.EXPO_PUBLIC_API_URL!)];
    if (urls.some((url) => !['http:', 'https:'].includes(url.protocol)))
      return 'Cấu hình kết nối chưa hợp lệ. Vui lòng liên hệ người quản trị.';
  } catch {
    return 'Cấu hình kết nối chưa hợp lệ. Vui lòng liên hệ người quản trị.';
  }
  const key = variables.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
  if (key.startsWith('sb_secret_'))
    return 'Cấu hình bảo mật chưa phù hợp cho ứng dụng. Vui lòng liên hệ người quản trị.';
  if (key.startsWith('eyJ')) {
    try {
      const role = JSON.parse(atob(key.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))).role;
      if (role === 'service_role')
        return 'Cấu hình bảo mật chưa phù hợp cho ứng dụng. Vui lòng liên hệ người quản trị.';
    } catch {
      return 'Cấu hình tài khoản chưa hợp lệ. Vui lòng liên hệ người quản trị.';
    }
  }
  return null;
}
