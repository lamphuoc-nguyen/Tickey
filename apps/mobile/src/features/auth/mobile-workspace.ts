import type { ActiveWorkspace, Workspace } from '@event/core';
import { safeReturnPath } from './safe-return-path';

export type MobileWorkspaceKind = 'CUSTOMER' | 'STAFF';

export function isStaffWorkspace(workspace: Pick<ActiveWorkspace, 'kind' | 'orgId' | 'roles'>): boolean {
  return (
    workspace.kind === 'STAFF' &&
    !!workspace.orgId &&
    workspace.roles.some((role) => ['SCANNER', 'POS', 'GATE_MANAGER'].includes(role))
  );
}

export function mobileWorkspaceDestination(kind: MobileWorkspaceKind, next?: string): string {
  const path = safeReturnPath(next);
  if (kind === 'STAFF') return path.startsWith('/staff/') && path !== '/staff/workspaces' ? path : '/staff';
  return path === '/staff' || path.startsWith('/staff/') || path.startsWith('/staff?') ? '/' : path;
}

/** Server-confirmed Staff membership takes precedence over the universal CUSTOMER workspace. */
export function automaticMobileDestination(
  workspaces: readonly Workspace[],
  active: ActiveWorkspace,
  next?: string,
): string | null {
  if (workspaces.some(isStaffWorkspace)) return mobileWorkspaceDestination('STAFF', next);
  if (active.kind === 'STAFF') return '/staff';
  if (workspaces.some((workspace) => workspace.kind === 'CUSTOMER'))
    return mobileWorkspaceDestination('CUSTOMER', next);
  return null;
}
