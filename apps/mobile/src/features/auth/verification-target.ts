/** A verification route must carry the email submitted in the preceding auth step. */
export function verificationTargetEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  const email = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}
