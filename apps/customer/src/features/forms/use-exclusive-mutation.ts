import { useIsMutating, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { runExclusive } from './exclusive-request';
export function useExclusiveMutation<Result, Variables>(
  scope: string,
  options: {
    mutationFn: (variables: Variables) => Promise<Result>;
    onSuccess?: (result: Result) => unknown;
    retry?: false;
  },
) {
  const { session } = useAuth();
  const key = ['customer-write', session?.userId ?? 'guest', scope];
  const mutation = useMutation({
    ...options,
    mutationKey: key,
    retry: false,
    mutationFn: (variables: Variables) => runExclusive(key.join(':'), () => options.mutationFn(variables)),
  });
  const count = useIsMutating({ mutationKey: key });
  return { ...mutation, isPending: mutation.isPending || count > 0 };
}
