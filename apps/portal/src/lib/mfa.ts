import type { Session } from '@supabase/supabase-js';

/** The session's assurance level from its JWT: 'aal2' once the TOTP code was verified. */
function tokenAal(accessToken: string): string | null {
  try {
    const payload = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return (JSON.parse(atob(payload)) as { aal?: string }).aal ?? null;
  } catch {
    return null;
  }
}

/** Signed in with the password only while the user has a verified TOTP factor. */
export const isMfaPending = (session: Pick<Session, 'access_token' | 'user'> | null) =>
  !!session &&
  !!session.user.factors?.some((f) => f.status === 'verified') &&
  tokenAal(session.access_token) !== 'aal2';
