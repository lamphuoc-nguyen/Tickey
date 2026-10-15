import { describe, expect, it } from 'vitest';
import { ApiError, type AuthSession, type Workspace } from '@event/core';
import { staffAccess } from './staff-access';
import { activateMobileWorkspace } from '../auth/activate-mobile-workspace';
import { assertMobileWorkspaceChange } from '../auth/mobile-access';

const customer: Workspace = {
  kind: 'CUSTOMER',
  orgId: null,
  orgName: null,
  orgStatus: null,
  roles: [],
  requiresMfa: false,
};
const staff: Workspace = { ...customer, kind: 'STAFF', orgId: 'org-a', roles: ['SCANNER'] };
const session: AuthSession = { userId: 'account-a', email: 'member@example.test', workspace: customer };
const base = { session, authLoading: false, membershipPending: false, workspaces: [customer, staff] };

describe('Staff membership gate, including direct links', () => {
  it('keeps unauthenticated links separate from customers without Staff rights', () => {
    expect(staffAccess({ ...base, session: null })).toBe('unauthenticated');
    expect(staffAccess({ ...base, workspaces: [customer] })).toBe('forbidden');
  });
  it('does not treat loading or failed membership retrieval as absence of rights', () => {
    expect(staffAccess({ ...base, authLoading: true })).toBe('loading');
    expect(staffAccess({ ...base, membershipPending: true })).toBe('loading');
    expect(staffAccess({ ...base, workspaces: undefined })).toBe('loading');
    expect(staffAccess({ ...base, membershipError: new ApiError('NETWORK') })).toBe('error');
    expect(staffAccess({ ...base, authError: new ApiError('NETWORK') })).toBe('error');
  });
  it('requires an explicit organization choice, then refreshed Staff claims and live membership', () => {
    expect(staffAccess(base)).toBe('select-workspace');
    expect(staffAccess({ ...base, session: { ...session, workspace: staff } })).toBe('allowed');
    expect(staffAccess({ ...base, session: { ...session, workspace: { ...staff, orgId: 'org-b' } } })).toBe(
      'revoked',
    );
  });
  it('blocks recalled Staff claims after membership is removed, including stale successful data on error', () => {
    const active = { ...session, workspace: staff };
    expect(staffAccess({ ...base, session: active, workspaces: [customer] })).toBe('revoked');
    expect(staffAccess({ ...base, session: active, workspaces: [customer, { ...staff, roles: [] }] })).toBe(
      'revoked',
    );
    expect(staffAccess({ ...base, session: active, membershipError: new ApiError('NETWORK') })).toBe('error');
  });
  it('activates the assigned Staff organization but refuses switching back to CUSTOMER', async () => {
    let current = session;
    const repository = {
      setActiveWorkspace: async (kind: Workspace['kind'], orgId: string | null = null) => {
        current = { ...session, workspace: kind === 'STAFF' ? { ...staff, orgId } : customer };
      },
    };
    assertMobileWorkspaceChange(staff, current, base.workspaces);
    await activateMobileWorkspace(staff, session.userId, repository, async () => current);
    expect(staffAccess({ ...base, session: current })).toBe('allowed');
    expect(() => assertMobileWorkspaceChange(customer, current, base.workspaces)).toThrow(ApiError);
    expect(current.workspace.kind).toBe('STAFF');
    expect(current.userId).toBe(session.userId);
    expect(staffAccess({ ...base, session: current })).toBe('allowed');
  });
});
