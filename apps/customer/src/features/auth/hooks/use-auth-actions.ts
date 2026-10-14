import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { repositories } from '@/lib/repositories';
import { useAuth } from './auth-context';
import { useBookingDraft } from '@/features/booking/draft-store';
import { ticketCache } from '@/features/tickets/hooks/use-ticket';
import { clearLocalReminders } from '@/features/notifications/hooks/use-reminders';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';

export function useAuthActions() {
  const { session } = useAuth();
  const cache = useQueryClient();
  const login = useExclusiveMutation('auth-login', {
    mutationFn: (p: { email: string; password: string }) => repositories.auth.login(p.email, p.password),
  });
  const register = useExclusiveMutation('auth-register', {
    mutationFn: (p: { email: string; password: string; name: string }) =>
      repositories.auth.register(
        p.email,
        p.password,
        p.name,
        Linking.createURL('auth/callback', { queryParams: { type: 'signup' } }),
      ),
  });
  const forgot = useExclusiveMutation('auth-forgot', {
    mutationFn: (email: string) =>
      repositories.auth.forgotPassword(
        email,
        Linking.createURL('auth/callback', { queryParams: { type: 'recovery' } }),
      ),
  });
  const reset = useExclusiveMutation('auth-reset', {
    mutationFn: (password: string) => repositories.auth.resetPassword(password),
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
    mutationFn: (p: { email: string; token: string; signup?: boolean }) =>
      repositories.auth.verifyOtp(p.email, p.token, p.signup ? 'signup' : 'email'),
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
    queryKey: ['workspaces', session?.userId],
    queryFn: () => repositories.workspace.listMyWorkspaces(),
    enabled: !!session,
  });
  const switchWorkspace = useExclusiveMutation('auth-workspace', {
    mutationFn: () => repositories.workspace.setActiveWorkspace('CUSTOMER'),
    onSuccess: async () => {
      await cache.cancelQueries();
      cache.clear();
    },
  });
  return { login, register, forgot, reset, otp, resendSignup, verify, logout, workspaces, switchWorkspace };
}
