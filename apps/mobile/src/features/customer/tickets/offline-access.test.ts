import { describe, expect, it } from 'vitest';
import { ApiError, type AuthSession, type Workspace } from '@event/core';
import { canReadOfflineSnapshots } from './offline-access';

const customer: AuthSession = {
  userId: 'customer',
  email: 'customer@test.invalid',
  workspace: { kind: 'CUSTOMER', orgId: null, roles: [] },
};
const staff: Workspace = {
  kind: 'STAFF',
  orgId: 'org',
  roles: ['SCANNER'],
  orgName: 'Organization',
  orgStatus: 'ACTIVE',
  requiresMfa: false,
};
const input = { pathname: '/tickets/offline', online: false, session: customer, loading: false };
describe('read-only offline ticket access', () => {
  it('allows own local snapshots when membership cannot be reached', () => {
    expect(canReadOfflineSnapshots({ ...input, membershipError: new ApiError('NETWORK') })).toBe(true);
    expect(canReadOfflineSnapshots({ ...input, session: null, authError: new ApiError('NETWORK') })).toBe(
      true,
    );
  });
  it('never opens authenticated Customer routes or grants access online', () => {
    for (const pathname of ['/orders', '/tickets/id', '/', '/sessions/id/select'])
      expect(canReadOfflineSnapshots({ ...input, pathname })).toBe(false);
    expect(canReadOfflineSnapshots({ ...input, online: true })).toBe(false);
  });
  it('blocks a known Staff membership, Staff JWT, and explicit denials', () => {
    expect(canReadOfflineSnapshots({ ...input, workspaces: [staff] })).toBe(false);
    expect(canReadOfflineSnapshots({ ...input, session: { ...customer, workspace: staff } })).toBe(false);
    expect(canReadOfflineSnapshots({ ...input, membershipError: new ApiError('FORBIDDEN') })).toBe(false);
    expect(canReadOfflineSnapshots({ ...input, authError: new Error('invalid session') })).toBe(false);
    expect(canReadOfflineSnapshots({ ...input, loading: true })).toBe(false);
  });
});
