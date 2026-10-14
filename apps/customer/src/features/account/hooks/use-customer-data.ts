import type { NotificationPreferences } from '@event/core';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { repositories } from '@/lib/repositories';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';

function usePaged<T>(key: string, load: (offset: number, signal: AbortSignal) => Promise<T[]>) {
  const { session } = useAuth();
  return useInfiniteQuery({
    queryKey: [key, session?.userId],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => load(pageParam, signal),
    getNextPageParam: (last, pages) => (last.length === 20 ? pages.length * 20 : undefined),
    enabled: !!session && session.workspace.kind === 'CUSTOMER',
  });
}
export function useOrders() {
  return usePaged('orders', (offset, signal) => repositories.customer.orders(offset, signal));
}
export function useTickets() {
  return usePaged('tickets', (offset, signal) => repositories.customer.tickets(offset, signal));
}
export function useNotifications() {
  return usePaged('notifications', (offset, signal) => repositories.customer.notifications(offset, signal));
}
export function useRefunds() {
  return usePaged('refunds', (offset, signal) => repositories.customer.refunds(offset, signal));
}
export function useReports() {
  return usePaged('reports', (offset, signal) => repositories.customer.reports(offset, signal));
}
export function useSupport() {
  return usePaged('support', (offset, signal) => repositories.customer.supportRequests(offset, signal));
}
export function useProfile() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['profile', session?.userId],
    queryFn: ({ signal }) => repositories.customer.profile(signal),
    enabled: !!session && session.workspace.kind === 'CUSTOMER',
  });
}
export function usePreferences() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['preferences', session?.userId],
    queryFn: () => repositories.preferences.get(),
    enabled: !!session && session.workspace.kind === 'CUSTOMER',
  });
}
export function useAccountActions() {
  const cache = useQueryClient();
  const { session } = useAuth();
  return {
    updateProfile: useExclusiveMutation('update-profile', {
      mutationFn: (p: { fullName: string; phone: string }) => repositories.customer.updateProfile(p),
      onSuccess: (p) => cache.setQueryData(['profile', session?.userId], p),
    }),
    savePreferences: useExclusiveMutation('save-preferences', {
      mutationFn: (p: NotificationPreferences) => repositories.preferences.save(p),
      onSuccess: (p) => cache.setQueryData(['preferences', session?.userId], p),
    }),
    markRead: useExclusiveMutation('mark-notification-read', {
      mutationFn: (ids: string[]) => repositories.customer.markRead(ids),
      onSuccess: () => cache.invalidateQueries({ queryKey: ['notifications', session?.userId] }),
    }),
  };
}
