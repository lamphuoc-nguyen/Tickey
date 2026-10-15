import { describe, expect, it } from 'vitest';
import { ApiError, type AuthSession, type Workspace } from '@event/core';
import { assertMobileWorkspaceChange, mobileAccess } from './mobile-access';

const customer: Workspace = { kind: 'CUSTOMER', orgId: null, orgName: null, orgStatus: null, roles: [], requiresMfa: false };
const staff: Workspace = { ...customer, kind: 'STAFF', orgId: 'org-a', roles: ['SCANNER'] };
const session: AuthSession = { userId: 'account-a', email: 'member@example.test', workspace: customer };
const base = { session, authLoading: false, membershipPending: false, workspaces: [customer] };

describe('one app with server-selected, exclusive Customer/Staff interfaces', () => {
  it('allows guest browsing and Customer accounts but directs dual memberships exclusively to Staff', () => {
    expect(mobileAccess({ ...base, session: null })).toBe('guest');
    expect(mobileAccess(base)).toBe('customer');
    expect(mobileAccess({ ...base, workspaces: [customer, staff] })).toBe('staff');
    expect(mobileAccess({ ...base, workspaces: [customer, { ...staff, orgId: null }] })).toBe('customer');
    expect(mobileAccess({ ...base, workspaces: [] })).toBe('forbidden');
  });
  it('never treats loading, auth errors or membership errors with stale data as Customer authorization', () => {
    expect(mobileAccess({ ...base, authLoading: true })).toBe('loading');
    expect(mobileAccess({ ...base, workspaces: undefined })).toBe('loading');
    expect(mobileAccess({ ...base, membershipPending: true })).toBe('loading');
    expect(mobileAccess({ ...base, authError: new ApiError('NETWORK') })).toBe('error');
    expect(mobileAccess({ ...base, membershipError: new ApiError('NETWORK') })).toBe('error');
  });
  it('blocks revoked Staff on Customer links rather than activating the universal CUSTOMER row', () => {
    expect(mobileAccess({ ...base, session: { ...session, workspace: staff } })).toBe('revoked');
    expect(() => assertMobileWorkspaceChange(customer, { ...session, workspace: staff }, [customer])).toThrow(ApiError);
  });
  it('allows only server-assigned Staff organizations, never a cross-role selection', () => {
    const other = { ...staff, orgId: 'org-b', roles: ['POS'] };
    expect(() => assertMobileWorkspaceChange(customer, session, [customer, staff])).toThrow(ApiError);
    expect(() => assertMobileWorkspaceChange(staff, session, [customer])).toThrow(ApiError);
    expect(() => assertMobileWorkspaceChange(other, session, [customer, staff])).toThrow(ApiError);
    expect(() => assertMobileWorkspaceChange(other, { ...session, workspace: staff }, [customer, staff, other])).not.toThrow();
    expect(() => assertMobileWorkspaceChange(customer, session, [customer])).not.toThrow();
    expect(() => assertMobileWorkspaceChange(staff, null, [customer, staff])).toThrow(ApiError);
  });
  it('re-evaluates a different account from its own memberships, without persisting a local role choice', () => {
    expect(mobileAccess({ ...base, workspaces: [customer, staff] })).toBe('staff');
    expect(mobileAccess({ ...base, session: { ...session, userId: 'account-b' }, workspaces: [customer] })).toBe('customer');
    expect(mobileAccess({ ...base, session: { ...session, userId: 'account-b' }, workspaces: undefined })).toBe('loading');
  });
});
