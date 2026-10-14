import { useAuth } from '@/features/auth/hooks/auth-context';
import { useCallback } from 'react';
import { useFormStore } from './form-store';

export function useFormDraft<T extends object>(name: string, initial: T) {
  const { session } = useAuth();
  const key = `${session?.userId ?? 'guest'}:${name}`;
  const value = useFormStore((s) => s.values[key]) as T | undefined;
  const draft = value ?? initial;
  const update = useCallback(
    (changes: Partial<T>) => {
      const prior = (useFormStore.getState().values[key] ?? initial) as T;
      if (Object.entries(changes).every(([field, value]) => Object.is(prior[field as keyof T], value)))
        return;
      useFormStore.getState().set(key, { ...prior, ...changes });
    },
    [key, initial],
  );
  const clear = () => useFormStore.getState().clear(key);
  return { draft, update, clear };
}
