import type { WorkspaceKind } from '@event/core';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSession } from '../lib/use-session';

// Route guard by active workspace. In dev mode without active Supabase, allows UI preview.
export function RequireWorkspace({ kind, children }: { kind: WorkspaceKind; children: ReactNode }) {
  const { loading, session, workspace } = useSession();

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

  // If there's a session and user has a different workspace kind, guide to /workspaces
  // In dev mode, allow switching between /org and /admin for inspection
  if (session && workspace.kind !== kind && workspace.kind !== 'CUSTOMER' && !import.meta.env.DEV) {
    return <Navigate to="/workspaces" replace />;
  }

  return children;
}
