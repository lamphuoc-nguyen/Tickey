import type { AuthSession } from '@event/core';

export function sessionScope(session: AuthSession | null) {
  return [
    session?.userId ?? 'guest',
    session?.workspace.kind ?? 'PUBLIC',
    session?.workspace.orgId ?? null,
  ] as const;
}

export function sessionIdentity(session: AuthSession | null): string {
  return JSON.stringify(sessionScope(session));
}
