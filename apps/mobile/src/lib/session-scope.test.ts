import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import type { AuthSession } from '@event/core';
import { sessionIdentity, sessionScope } from './session-scope';

const customer: AuthSession = {
  userId: 'account-a',
  email: 'account@example.test',
  workspace: { kind: 'CUSTOMER', orgId: null, roles: [] },
};

describe('private cache isolation in one mobile app', () => {
  it('separates account, mode and Staff organization identities', () => {
    const identities = [
      customer,
      { ...customer, userId: 'account-b' },
      { ...customer, workspace: { kind: 'STAFF' as const, orgId: 'org-a', roles: ['SCANNER'] } },
      { ...customer, workspace: { kind: 'STAFF' as const, orgId: 'org-b', roles: ['SCANNER'] } },
      null,
    ].map(sessionIdentity);
    expect(new Set(identities).size).toBe(5);
  });
  it('cannot read a late completion from an old account/workspace after cache is cleared', async () => {
    const cache = new QueryClient();
    const oldKey = ['profile', ...sessionScope(customer)];
    cache.setQueryData(oldKey, { account: customer.userId });
    await cache.cancelQueries();
    cache.clear();
    const next = { ...customer, userId: 'account-b' };
    cache.setQueryData(oldKey, { account: customer.userId }); // A late mutation stays in its old scope.
    expect(cache.getQueryData(['profile', ...sessionScope(next)])).toBeUndefined();
    expect(cache.getQueryData(['profile', ...sessionScope(null)])).toBeUndefined();
    expect(
      cache.getQueryData([
        'profile',
        ...sessionScope({ ...customer, workspace: { kind: 'STAFF', orgId: 'org-a', roles: ['POS'] } }),
      ]),
    ).toBeUndefined();
    cache.clear();
  });
});
