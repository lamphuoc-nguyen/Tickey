import { ApiError, type AuthSession, type Workspace } from '@event/core';
import { isStaffWorkspace } from './mobile-workspace';

export type MobileAccess = 'loading' | 'error' | 'guest' | 'customer' | 'staff' | 'revoked' | 'forbidden';

/** Product routing policy. RLS/RPC remain responsible for authorization on the server. */
export function mobileAccess(input: {
  session: AuthSession | null;
  authLoading: boolean;
  authError?: unknown;
  membershipPending: boolean;
  membershipError?: unknown;
  workspaces?: readonly Workspace[];
}): MobileAccess {
  if (input.authLoading) return 'loading';
  if (input.authError) return 'error';
  if (!input.session) return 'guest';
  if (input.membershipError) return 'error';
  if (input.membershipPending || !input.workspaces) return 'loading';
  // CUSTOMER is included for every account by the existing RPC; Staff takes precedence.
  if (input.workspaces.some(isStaffWorkspace)) return 'staff';
  // A revoked Staff workspace must not silently become a Customer session.
  if (input.session.workspace.kind === 'STAFF') return 'revoked';
  return input.workspaces.some((workspace) => workspace.kind === 'CUSTOMER') ? 'customer' : 'forbidden';
}

export function assertMobileWorkspaceChange(
  target: Workspace,
  session: AuthSession | null,
  workspaces: readonly Workspace[],
): void {
  if (!session) throw new ApiError('UNAUTHENTICATED');
  const access = mobileAccess({ session, workspaces, authLoading: false, membershipPending: false });
  const permitted =
    (access === 'customer' && target.kind === 'CUSTOMER') ||
    (access === 'staff' && isStaffWorkspace(target));
  if (!permitted || !workspaces.some((row) => row.kind === target.kind && row.orgId === target.orgId))
    throw new ApiError('FORBIDDEN');
}
