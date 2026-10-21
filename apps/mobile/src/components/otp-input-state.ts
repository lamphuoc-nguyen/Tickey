export const MIN_OTP_LENGTH = 6;
export const MAX_OTP_LENGTH = 10;

export function otpCellCount(value: string): number {
  return Math.max(MIN_OTP_LENGTH, Math.min(MAX_OTP_LENGTH, value.length));
}

export function editOtp(value: string, index: number, text: string) {
  const digits = text.replace(/\D/g, '');
  if (text && !digits) return { value, focus: index };
  // Autofill and full-code paste replace the code, even from a later cell.
  const start = digits.length >= MIN_OTP_LENGTH ? 0 : index;
  const next = value.slice(0, MAX_OTP_LENGTH).split('');
  while (next.length < start) next.push(' ');
  if (!digits) next[start] = ' ';
  else for (let i = 0; i < digits.length && start + i < MAX_OTP_LENGTH; i++) next[start + i] = digits[i]!;
  if (start === 0 && digits.length >= MIN_OTP_LENGTH) next.length = Math.min(digits.length, MAX_OTP_LENGTH);
  const updated = next.join('').trimEnd();
  return {
    value: updated,
    focus: digits ? Math.min(start + digits.length, otpCellCount(updated) - 1) : index,
  };
}

export function backspaceOtp(value: string, index: number) {
  const target = value[index]?.trim() ? index : Math.max(0, index - 1);
  return { ...editOtp(value, target, ''), focus: target };
}
