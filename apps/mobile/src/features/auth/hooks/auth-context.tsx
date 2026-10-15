import type { AuthSession } from '@event/core';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';
import { router } from 'expo-router';
import { focusManager, onlineManager, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { repositories } from '@/lib/repositories';
import { useBookingDraft } from '@/features/customer/booking/draft-store';
import { ticketCache } from '@/features/customer/tickets/ticket-cache-instance';
import { useFormStore } from '@/features/forms/form-store';
import { sessionIdentity } from '@/lib/session-scope';

const AuthContext = createContext<{
  session: AuthSession | null;
  loading: boolean;
  error: unknown;
  retry: () => void;
  refresh: () => Promise<AuthSession | null>;
}>({
  session: null,
  loading: true,
  error: null,
  retry: () => {},
  refresh: async () => null,
});
export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const previous = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const previousUser = useRef<string | null>(null);
  const retrySession = useRef<() => void>(() => {});
  const refreshSession = useRef<() => Promise<AuthSession | null>>(async () => null);
  const refresh = useCallback(() => refreshSession.current(), []);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    const unsubscribe = NetInfo.addEventListener((state) =>
      onlineManager.setOnline(state.isConnected !== false && state.isInternetReachable !== false),
    );
    return () => {
      listener.remove();
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    let generation = 0;
    const update = async (next: AuthSession | null, event = 'LOAD') => {
      const current = ++generation;
      const identity = sessionIdentity(next);
      if (previous.current !== identity) setLoading(true);
      ticketCache.activate(next?.workspace.kind === 'CUSTOMER' ? next.userId : null);
      const savedAccount = await ticketCache.lastAccount();
      if (savedAccount && ((next && savedAccount !== next.userId) || event === 'SIGNED_OUT'))
        await ticketCache.clear(savedAccount);
      if (!alive || current !== generation) return;
      if (previousUser.current && previousUser.current !== next?.userId) {
        useBookingDraft.getState().clear();
        useFormStore.getState().clear();
      }
      previousUser.current = next?.userId ?? null;
      if (previous.current !== identity) {
        await queryClient.cancelQueries();
        if (!alive || current !== generation) return;
        queryClient.clear();
        previous.current = identity;
      }
      if (!alive || current !== generation) return;
      setSession(next);
      setError(null);
      setLoading(false);
    };
    refreshSession.current = async () => {
      const startedAt = generation;
      const next = await repositories.auth.session();
      if (startedAt === generation) await update(next);
      // An auth event may supersede this read while storage/cache cancellation is pending.
      return repositories.auth.session();
    };
    retrySession.current = () => {
      setLoading(true);
      setError(null);
      void refreshSession.current().catch((e: unknown) => {
        if (alive) {
          setError(e);
          setLoading(false);
        }
      });
    };
    void repositories.auth
      .session()
      .then(update)
      .catch((e: unknown) => {
        if (alive) {
          setError(e);
          setLoading(false);
        }
      });
    const unsubscribe = repositories.auth.subscribe((next, event) => {
      void update(next, event).catch((e: unknown) => {
        if (alive) {
          setError(e);
          setLoading(false);
        }
      });
      if (event === 'PASSWORD_RECOVERY') router.replace('/auth/reset');
    });
    const listener = AppState.addEventListener('change', (state) =>
      repositories.auth.setForeground(state === 'active'),
    );
    repositories.auth.setForeground(AppState.currentState === 'active');
    return () => {
      alive = false;
      unsubscribe();
      listener.remove();
    };
  }, [queryClient]);
  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        error,
        retry: () => retrySession.current(),
        refresh,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  return useContext(AuthContext);
}
