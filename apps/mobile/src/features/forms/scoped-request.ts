import { ApiError, type AuthSession } from '@event/core';
import { sessionIdentity } from '../../lib/session-scope';

/** Do not continue a multi-step operation or publish a late result into another account's UI. */
export async function runScopedRequest<T>(
  expected: AuthSession | null,
  current: () => Promise<AuthSession | null>,
  run: (assertCurrent: () => Promise<void>) => Promise<T>,
): Promise<T> {
  const assertCurrent = async () => {
    const actual = await current();
    if (!expected || !actual) throw new ApiError('UNAUTHENTICATED');
    if (sessionIdentity(expected) !== sessionIdentity(actual))
      throw new ApiError('FORBIDDEN', { reason: 'SESSION_SCOPE_CHANGED' });
  };
  await assertCurrent();
  const result = await run(assertCurrent);
  await assertCurrent();
  return result;
}
