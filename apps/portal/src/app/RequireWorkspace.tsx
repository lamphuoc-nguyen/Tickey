import type { WorkspaceKind } from '@event/core';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../lib/use-session';

// Route guard by active workspace. In dev mode without active Supabase, allows UI preview.
export function RequireWorkspace({ kind, children }: { kind: WorkspaceKind; children: ReactNode }) {
  const { loading, session, workspace, mfaPending } = useSession();
  const { pathname } = useLocation();

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg)',
          color: 'var(--muted)',
          fontSize: '14px',
        }}
      >
        Đang khởi động Tickey Studio…
      </div>
    );
  }

  // Every page reads and writes through the API with the user's JWT, so there is nothing to show signed out.
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Password alone is not enough for a user with 2FA: Back from the TOTP screen must not reopen the portal.
  if (mfaPending) {
    return <Navigate to="/mfa" replace />;
  }

  // A signed-in user without an Org (CUSTOMER workspace) may only reach onboarding, where step 1 creates one.
  // Everything else needs the matching workspace; dev builds may still switch freely for inspection.
  const creatingOrg = kind === 'ORG' && workspace.kind === 'CUSTOMER' && pathname.startsWith('/org/onboarding');
  if (workspace.kind !== kind && !creatingOrg && !import.meta.env.DEV) {
    return <Navigate to="/workspaces" replace />;
  }

  return children;
}
