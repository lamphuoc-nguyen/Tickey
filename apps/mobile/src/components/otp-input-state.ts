export const OTP_LENGTH = 8;

export function isCompleteOtp(value: string): boolean {
  return /^\d{8}$/.test(value.trim());
}

export function editOtp(value: string, index: number, text: string) {
  const digits = text.replace(/\D/g, '');
  if (text && !digits) return { value, focus: index };
  // Autofill and full-code paste replace the code, even from a later cell.
  const start = digits.length >= OTP_LENGTH ? 0 : index;
  const next = value.slice(0, OTP_LENGTH).split('');
  while (next.length < start) next.push(' ');
  if (!digits) next[start] = ' ';
  else for (let i = 0; i < digits.length && start + i < OTP_LENGTH; i++) next[start + i] = digits[i]!;
  if (start === 0 && digits.length >= OTP_LENGTH) next.length = OTP_LENGTH;
  const updated = next.join('').trimEnd();
  return {
    value: updated,
    focus: digits ? Math.min(start + digits.length, OTP_LENGTH - 1) : index,
  };
}

export function backspaceOtp(value: string, index: number) {
  const target = value[index]?.trim() ? index : Math.max(0, index - 1);
  return { ...editOtp(value, target, ''), focus: target };
}
