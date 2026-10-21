import { useIsMutating, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { runExclusive } from './exclusive-request';
import { sessionScope } from '@/lib/session-scope';
import { repositories } from '@/lib/repositories';
import { runScopedRequest } from './scoped-request';
export function useExclusiveMutation<Result, Variables>(
  scope: string,
  options: {
    mutationFn: (variables: Variables, assertCurrent: () => Promise<void>) => Promise<Result>;
    onSuccess?: (result: Result) => unknown;
    retry?: false;
  },
) {
  const { session } = useAuth();
  const key = scope.startsWith('auth-')
    ? ['mobile-write', session?.userId ?? 'guest', 'auth', scope]
    : ['mobile-write', ...sessionScope(session), scope];
  const mutation = useMutation({
    ...options,
    mutationKey: key,
    retry: false,
    mutationFn: (variables: Variables) =>
      runExclusive(key.join(':'), () =>
        scope.startsWith('auth-')
          ? options.mutationFn(variables, async () => {})
          : runScopedRequest(
              session,
              () => repositories.auth.session(),
              (assertCurrent) => options.mutationFn(variables, assertCurrent),
            ),
      ),
  });
  const count = useIsMutating({ mutationKey: key });
  return { ...mutation, isPending: mutation.isPending || count > 0 };
}
