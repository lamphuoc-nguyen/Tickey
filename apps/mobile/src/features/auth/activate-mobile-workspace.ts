import { ApiError, type AuthSession, type Workspace, type WorkspaceRepository } from '@event/core';
import { isStaffWorkspace } from './mobile-workspace';

export async function activateMobileWorkspace(
  workspace: Workspace,
  userId: string | undefined,
  repository: Pick<WorkspaceRepository, 'setActiveWorkspace'>,
  refresh: () => Promise<AuthSession | null>,
): Promise<AuthSession> {
  if (!userId) throw new ApiError('UNAUTHENTICATED');
  if (workspace.kind !== 'CUSTOMER' && !isStaffWorkspace(workspace)) throw new ApiError('FORBIDDEN');
  await repository.setActiveWorkspace(workspace.kind, workspace.orgId);
  const updated = await refresh();
  if (!updated) throw new ApiError('UNAUTHENTICATED');
  if (
    updated.userId !== userId ||
    updated.workspace.kind !== workspace.kind ||
    updated.workspace.orgId !== workspace.orgId ||
    (workspace.kind === 'STAFF' && !isStaffWorkspace(updated.workspace))
  )
    throw new ApiError('INVALID_STATE', { reason: 'WORKSPACE_NOT_ACTIVATED' });
  return updated;
}
