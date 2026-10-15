import { describe, expect, it, vi } from 'vitest';
import { ApiError, type AuthSession, type Workspace } from '@event/core';
import { activateMobileWorkspace } from './activate-mobile-workspace';
import { automaticMobileDestination, isStaffWorkspace, mobileWorkspaceDestination } from './mobile-workspace';

// Authorization fixtures are used only by tests, never by the app.
const customer: Workspace = {
  kind: 'CUSTOMER',
  orgId: null,
  orgName: null,
  orgStatus: null,
  roles: [],
  requiresMfa: false,
};
const staff: Workspace = { ...customer, kind: 'STAFF', orgId: 'org-a', roles: ['SCANNER'] };
const session: AuthSession = { userId: 'account-a', email: 'staff@example.test', workspace: staff };

describe('shared mobile role routing', () => {
  it('routes Staff membership to Staff even though the RPC also includes CUSTOMER', () => {
    expect(automaticMobileDestination([customer], customer, '/orders')).toBe('/orders');
    expect(automaticMobileDestination([customer, staff], customer)).toBe('/staff');
    expect(automaticMobileDestination([customer, staff], customer, '/orders')).toBe('/staff');
    expect(automaticMobileDestination([customer], customer, '/staff')).toBe('/');
    expect(
      automaticMobileDestination([customer, { ...customer, kind: 'ORG', orgId: 'org-a' }], customer),
    ).toBe('/');
  });
  it('preserves Staff-only return paths and never sends revoked Staff into Customer', () => {
    expect(automaticMobileDestination([customer, staff], staff, '/staff/scan')).toBe('/staff/scan');
    expect(automaticMobileDestination([customer, { ...staff, orgId: 'org-b' }], staff)).toBe('/staff');
    expect(automaticMobileDestination([customer], staff, '/tickets/offline')).toBe('/staff');
  });
  it('requires Staff scope, organization and a server-assigned Staff role', () => {
    expect(isStaffWorkspace(staff)).toBe(true);
    for (const workspace of [
      customer,
      { ...staff, orgId: null },
      { ...staff, roles: ['OWNER'] },
      { ...staff, kind: 'ORG' as const },
    ])
      expect(isStaffWorkspace(workspace)).toBe(false);
  });
  it('keeps Customer return paths isolated from Staff and external destinations', () => {
    expect(mobileWorkspaceDestination('STAFF', '/booking/order-a')).toBe('/staff');
    expect(mobileWorkspaceDestination('CUSTOMER', '/booking/order-a')).toBe('/booking/order-a');
    expect(mobileWorkspaceDestination('CUSTOMER', '/staff')).toBe('/');
    expect(mobileWorkspaceDestination('CUSTOMER', 'https://external.test')).toBe('/');
  });
});

describe('server-confirmed workspace activation', () => {
  it('uses the chosen organization and waits for refreshed session before accepting Staff', async () => {
    const repository = { setActiveWorkspace: vi.fn().mockResolvedValue(undefined) };
    const refresh = vi.fn(async () => {
      expect(repository.setActiveWorkspace).toHaveBeenCalledWith('STAFF', 'org-a');
      return session;
    });
    await expect(activateMobileWorkspace(staff, session.userId, repository, refresh)).resolves.toEqual(
      session,
    );
  });
  it('rejects stale claims, a different account and missing Staff privileges', async () => {
    const repository = { setActiveWorkspace: vi.fn().mockResolvedValue(undefined) };
    for (const updated of [
      { ...session, workspace: customer },
      { ...session, userId: 'account-b' },
      { ...session, workspace: { ...staff, orgId: 'org-b' } },
      { ...session, workspace: { ...staff, roles: [] } },
    ])
      await expect(
        activateMobileWorkspace(staff, session.userId, repository, async () => updated),
      ).rejects.toMatchObject({
        code: 'INVALID_STATE',
        details: { reason: 'WORKSPACE_NOT_ACTIVATED' },
      });
  });
  it('does not call activation for unauthenticated, portal or invalid Staff selections', async () => {
    const repository = { setActiveWorkspace: vi.fn() };
    await expect(
      activateMobileWorkspace(staff, undefined, repository, async () => session),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    for (const workspace of [
      { ...staff, kind: 'ORG' as const },
      { ...staff, orgId: null },
    ])
      await expect(
        activateMobileWorkspace(workspace, session.userId, repository, async () => session),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(repository.setActiveWorkspace).not.toHaveBeenCalled();
  });
  it('preserves a server denial and does not claim activation succeeded', async () => {
    const denied = new ApiError('FORBIDDEN');
    const repository = { setActiveWorkspace: vi.fn().mockRejectedValue(denied) };
    const refresh = vi.fn();
    await expect(activateMobileWorkspace(staff, session.userId, repository, refresh)).rejects.toBe(denied);
    expect(refresh).not.toHaveBeenCalled();
  });
});
