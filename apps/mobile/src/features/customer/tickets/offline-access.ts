import { ApiError, type AuthSession, type Workspace } from '@event/core';
import { isStaffWorkspace } from '../../auth/mobile-workspace';

/** Read-only device snapshots do not grant a role or authorize any server request. */
export function canReadOfflineSnapshots(input: {
  pathname: string;
  online: boolean;
  session: AuthSession | null;
  loading: boolean;
  authError?: unknown;
  membershipError?: unknown;
  workspaces?: readonly Workspace[];
}) {
  if (input.pathname !== '/tickets/offline' || input.online || input.loading) return false;
  if (input.session && input.session.workspace.kind !== 'CUSTOMER') return false;
  if (input.workspaces?.some(isStaffWorkspace)) return false;
  // A denial/malformed response is not a loss of connectivity.
  return [input.authError, input.membershipError].every(
    (error) => !error || (error instanceof ApiError && error.code === 'NETWORK'),
  );
}
