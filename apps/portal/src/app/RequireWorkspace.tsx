import type { WorkspaceKind } from '@event/core';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSession } from '../lib/use-session';

// Route guard by active workspace claim in JWT.
export function RequireWorkspace({ kind, children }: { kind: WorkspaceKind; children: ReactNode }) {
  const { loading, session, workspace } = useSession();
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

  // A signed-in user without an Org (CUSTOMER workspace) may only reach onboarding, where step 1 creates one.
  // Everything else needs the matching workspace according to the JWT claim.
  const creatingOrg = kind === 'ORG' && workspace.kind === 'CUSTOMER' && pathname.startsWith('/org/onboarding');
  if (workspace.kind !== kind && !creatingOrg) {
    return <Navigate to="/workspaces" replace />;
  }

  return children;
}
