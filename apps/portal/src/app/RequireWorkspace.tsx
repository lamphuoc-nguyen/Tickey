import type { WorkspaceKind } from '@event/core';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useSession } from '../lib/use-session';

// Route guard by active workspace (S0-FE3-1). UX only: every RPC is still checked by the server.
export function RequireWorkspace({ kind, children }: { kind: WorkspaceKind; children: ReactNode }) {
  const { loading, session, workspace } = useSession();
  if (loading) return null;
  if (!session) return <Navigate to="/login" replace />;
  if (workspace.kind !== kind) return <Navigate to="/workspaces" replace />;
  return children;
}
