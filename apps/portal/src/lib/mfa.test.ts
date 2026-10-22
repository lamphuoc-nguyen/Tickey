import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { isMfaPending } from './mfa';

const token = (claims: object) => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '')}.s`;
const session = (aal: string, factorStatus?: 'verified' | 'unverified') =>
  ({
    access_token: token({ aal }),
    user: { factors: factorStatus ? [{ status: factorStatus }] : [] },
  }) as unknown as Session;

describe('isMfaPending', () => {
  it('holds a password-only session of a user with a verified TOTP factor', () => {
    expect(isMfaPending(session('aal1', 'verified'))).toBe(true);
  });

  it('lets the session through once the TOTP code was verified', () => {
    expect(isMfaPending(session('aal2', 'verified'))).toBe(false);
  });

  it('does not hold users without a verified factor, or no session at all', () => {
    expect(isMfaPending(session('aal1'))).toBe(false);
    expect(isMfaPending(session('aal1', 'unverified'))).toBe(false);
    expect(isMfaPending(null)).toBe(false);
  });
});
