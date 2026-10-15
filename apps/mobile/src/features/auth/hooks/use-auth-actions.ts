import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { repositories } from '@/lib/repositories';
import { useAuth } from './auth-context';
import { useBookingDraft } from '@/features/customer/booking/draft-store';
import { ticketCache } from '@/features/customer/tickets/hooks/use-ticket';
import { clearLocalReminders } from '@/features/customer/notifications/hooks/use-reminders';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';
import type { Workspace } from '@event/core';
import { activateMobileWorkspace } from '../activate-mobile-workspace';
import { sessionScope } from '@/lib/session-scope';
import { assertMobileWorkspaceChange } from '../mobile-access';

export function useAuthActions() {
  const { session, refresh } = useAuth();
  const cache = useQueryClient();
  const login = useExclusiveMutation('auth-login', {
    mutationFn: async (p: { email: string; password: string }) => {
      await repositories.auth.login(p.email, p.password);
      await refresh();
    },
  });
  const register = useExclusiveMutation('auth-register', {
    mutationFn: async (p: { email: string; password: string; name: string }) => {
      const hasSession = await repositories.auth.register(
        p.email,
        p.password,
        p.name,
        Linking.createURL('auth/callback', { queryParams: { type: 'signup' } }),
      );
      if (hasSession) await refresh();
      return hasSession;
    },
  });
  const forgot = useExclusiveMutation('auth-forgot', {
    mutationFn: (email: string) =>
      repositories.auth.forgotPassword(
        email,
        Linking.createURL('auth/callback', { queryParams: { type: 'recovery' } }),
      ),
  });
  const reset = useExclusiveMutation('auth-reset', {
    mutationFn: async (password: string) => {
      await repositories.auth.resetPassword(password);
      await refresh();
    },
  });
  const otp = useExclusiveMutation('auth-otp', {
    mutationFn: (email: string) => repositories.auth.sendOtp(email),
  });
  const resendSignup = useExclusiveMutation('auth-resend-signup', {
    mutationFn: (email: string) =>
      repositories.auth.resendSignup(
        email,
        Linking.createURL('auth/callback', { queryParams: { type: 'signup' } }),
      ),
  });
  const verify = useExclusiveMutation('auth-verify', {
    mutationFn: async (p: { email: string; token: string; signup?: boolean }) => {
      await repositories.auth.verifyOtp(p.email, p.token, p.signup ? 'signup' : 'email');
      await refresh();
    },
  });
  const logout = useExclusiveMutation('auth-logout', {
    mutationFn: async () => {
      if (session) {
        await ticketCache.clear(session.userId);
        await clearLocalReminders(session.userId);
      }
      await repositories.auth.logout();
    },
    onSuccess: () => {
      cache.clear();
      useBookingDraft.getState().clear();
    },
  });
  const workspaces = useQuery({
    queryKey: ['workspaces', ...sessionScope(session)],
    queryFn: () => repositories.workspace.listMyWorkspaces(),
    enabled: !!session,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
    refetchInterval: session ? 30000 : false,
  });
  const switchWorkspace = useExclusiveMutation('auth-workspace', {
    mutationFn: async (workspace: Workspace) => {
      const current = await repositories.auth.session();
      if (current?.userId !== session?.userId) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
      const available = await repositories.workspace.listMyWorkspaces();
      assertMobileWorkspaceChange(workspace, current, available);
      return activateMobileWorkspace(workspace, current?.userId, repositories.workspace, refresh);
    },
    onSuccess: async () => {
      await cache.cancelQueries();
      cache.clear();
    },
  });
  return { login, register, forgot, reset, otp, resendSignup, verify, logout, workspaces, switchWorkspace };
}
