import { describe, expect, it } from 'vitest';
import type { AuthSession } from '@event/core';
import { needsCustomerWorkspace } from './customer-mode';

describe('Customer mode navigation ownership', () => {
  const staff: AuthSession = {
    userId: 'account-a',
    email: 'member@example.test',
    workspace: { kind: 'STAFF', orgId: 'org-a', roles: ['SCANNER'] },
  };
  it('never activates CUSTOMER for a Staff session, including offline-ticket and payment links', () => {
    expect(needsCustomerWorkspace(staff, '(customer)')).toBe(false);
    expect(needsCustomerWorkspace(null, '(customer)')).toBe(false);
    expect(needsCustomerWorkspace(staff, '(customer)', '/tickets/offline')).toBe(false);
    expect(
      needsCustomerWorkspace(
        { ...staff, workspace: { kind: 'CUSTOMER', orgId: null, roles: [] } },
        '(customer)',
      ),
    ).toBe(false);
    expect(needsCustomerWorkspace({ ...staff, workspace: { kind: 'ORG', orgId: 'org-a', roles: ['OWNER'] } }, '(customer)')).toBe(true);
  });
  it('does not let a retained Customer layout switch the workspace back while Staff/Auth is active', () => {
    expect(needsCustomerWorkspace(staff, '(staff)')).toBe(false);
    expect(needsCustomerWorkspace(staff, '(auth)')).toBe(false);
    expect(needsCustomerWorkspace(staff, undefined)).toBe(false);
  });
});
