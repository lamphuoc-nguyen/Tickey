import type { AuthSession, Workspace } from '@event/core';
import { isStaffWorkspace } from '../auth/mobile-workspace';

export type StaffAccess =
  'loading' | 'error' | 'unauthenticated' | 'forbidden' | 'revoked' | 'select-workspace' | 'allowed';

export function staffAccess(input: {
  session: AuthSession | null;
  authLoading: boolean;
  authError?: unknown;
  membershipPending: boolean;
  membershipError?: unknown;
  workspaces?: readonly Workspace[];
}): StaffAccess {
  if (input.authLoading) return 'loading';
  if (input.authError) return 'error';
  if (!input.session) return 'unauthenticated';
  if (input.membershipError) return 'error';
  if (input.membershipPending || !input.workspaces) return 'loading';
  const available = input.workspaces.filter(isStaffWorkspace);
  if (input.session.workspace.kind !== 'STAFF') return available.length ? 'select-workspace' : 'forbidden';
  const current = available.find((workspace) => workspace.orgId === input.session!.workspace.orgId);
  return current && isStaffWorkspace(input.session.workspace) ? 'allowed' : 'revoked';
}
