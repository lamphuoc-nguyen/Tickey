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
  return kind === 'STAFF' ? '/staff' : safeReturnPath(next);
}

/** Resolve only unambiguous, already active server workspaces. Never pick the first organization. */
export function automaticMobileDestination(
  workspaces: readonly Workspace[],
  active: ActiveWorkspace,
  next?: string,
): string | null {
  const current = workspaces.find(
    (workspace) => workspace.kind === active.kind && workspace.orgId === active.orgId,
  );
  if (!current) return null;
  if (isStaffWorkspace(active) && isStaffWorkspace(current)) return '/staff';
  if (active.kind === 'CUSTOMER' && workspaces.length === 1) return safeReturnPath(next);
  return null;
}
