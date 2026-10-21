import { describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '@event/core';
import { runScopedRequest } from './scoped-request';

const session: AuthSession = {
  userId: 'a',
  email: 'a@test.invalid',
  workspace: { kind: 'CUSTOMER', orgId: null, roles: [] },
};
describe('account-scoped writes', () => {
  it('rejects a request queued under a different account without sending', async () => {
    const send = vi.fn();
    await expect(
      runScopedRequest(session, async () => ({ ...session, userId: 'b' }), send),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(send).not.toHaveBeenCalled();
  });
  it('does not publish success after logout or a workspace change', async () => {
    let current: AuthSession | null = session;
    await expect(
      runScopedRequest(
        session,
        async () => current,
        async () => {
          current = null;
          return 'server accepted';
        },
      ),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    current = session;
    await expect(
      runScopedRequest(
        session,
        async () => current,
        async () => {
          current = { ...session, workspace: { kind: 'ORG', orgId: 'another', roles: [] } };
          return 'server accepted';
        },
      ),
    ).rejects.toMatchObject({ details: { reason: 'SESSION_SCOPE_CHANGED' } });
  });
  it('stops an upload sequence before sending evidence as a different user', async () => {
    let current = session;
    const submit = vi.fn();
    await expect(
      runScopedRequest(
        session,
        async () => current,
        async (assertCurrent) => {
          current = { ...session, userId: 'b' };
          await assertCurrent();
          return submit();
        },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(submit).not.toHaveBeenCalled();
  });
  it('keeps ordinary same-account responses and JWT refreshes valid', async () => {
    await expect(
      runScopedRequest(
        session,
        async () => ({ ...session }),
        async () => ({ id: 'real response' }),
      ),
    ).resolves.toEqual({ id: 'real response' });
  });
});
