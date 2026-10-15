import type { AuthSession } from '@event/core';

export function needsCustomerWorkspace(
  session: AuthSession | null,
  activeGroup: string | undefined,
  pathname?: string,
): boolean {
  // Downloaded tickets are account-scoped reads; opening them offline must not require a network write.
  return (
    activeGroup === '(customer)' &&
    pathname !== '/tickets/offline' &&
    !!session &&
    session.workspace.kind !== 'STAFF' &&
    session.workspace.kind !== 'CUSTOMER'
  );
}
