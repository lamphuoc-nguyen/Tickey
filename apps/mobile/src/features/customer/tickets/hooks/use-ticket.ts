import { sessionScope } from '@/lib/session-scope';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repositories } from '@/lib/repositories';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { ticketCache } from '../ticket-cache-instance';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';
import type { Ticket } from '@event/core';

export { ticketCache } from '../ticket-cache-instance';
export function useConnection() {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((state) =>
        setOnline(state.isConnected !== false && state.isInternetReachable !== false),
      ),
    [],
  );
  return online;
}
export function useSavedTickets() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['saved-tickets', ...sessionScope(session)],
    queryFn: () => ticketCache.list(session!.userId),
    enabled: !!session,
    networkMode: 'always',
  });
}
export function useTicket(id: string) {
  const { session } = useAuth();
  const online = useConnection();
  const cache = useQueryClient();
  const saved = useSavedTickets();
  const query = useQuery({
    queryKey: ['ticket', ...sessionScope(session), id],
    queryFn: async ({ signal }) => {
      const ticket = await repositories.customer.ticket(id, signal);
      if (session && (await ticketCache.list(session.userId)).some((saved) => saved.ticket.id === id)) {
        await ticketCache.save(session.userId, ticket, new Date().toISOString());
        void cache.invalidateQueries({ queryKey: ['saved-tickets', ...sessionScope(session)] });
      }
      return ticket;
    },
    enabled: online && !!session && session.workspace.kind === 'CUSTOMER' && !!id,
    refetchOnWindowFocus: true,
  });
  const refetch = query.refetch;
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && online && id && session?.workspace.kind === 'CUSTOMER') void refetch();
    });
    return () => listener.remove();
  }, [refetch, online, id, session?.workspace.kind]);
  const download = useMutation({
    mutationFn: async () => {
      if (!session || !query.data || !online) throw new Error('Cần tải vé mới từ máy chủ.');
      await ticketCache.save(session.userId, query.data, new Date().toISOString());
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ['saved-tickets', ...sessionScope(session)] }),
  });
  // Use saved snapshots only when explicitly offline, never to hide an online server error.
  const snapshot = saved.data?.find((t) => t.ticket.id === id);
  return {
    query,
    download,
    online,
    ticket: online ? query.data : snapshot?.ticket,
    downloadedAt: snapshot?.downloadedAt,
    saved,
  };
}
export function useHolder() {
  const cache = useQueryClient();
  return useExclusiveMutation('assign-holder', {
    mutationFn: (p: { id: string; name: string; email: string | null; phone: string | null }) =>
      repositories.customer.assignHolder(p.id, { name: p.name, email: p.email, phone: p.phone }),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['ticket'] });
      void cache.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
}

export function useOfflineTickets() {
  const auth = useAuth();
  const query = useQuery({
    queryKey: ['offline-ticket-snapshots', ...sessionScope(auth.session)],
    queryFn: async () => {
      const savedAccount = await ticketCache.lastAccount();
      const userId = auth.session?.userId ?? savedAccount;
      if (auth.session && savedAccount !== auth.session.userId) return [];
      return userId ? ticketCache.list(userId) : [];
    },
    enabled: !auth.loading,
    networkMode: 'always',
  });
  return {
    ...query,
    isPending: auth.loading || query.isPending,
    data: auth.loading ? undefined : query.data,
  };
}
export function useBookingTickets(id: string, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['booking-tickets', ...sessionScope(session), id],
    queryFn: ({ signal }) => repositories.customer.bookingTickets(id, signal),
    enabled: enabled && !!id && session?.workspace.kind === 'CUSTOMER',
  });
}
export function useOrder(id: string, enabled = true) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['order', ...sessionScope(session), id],
    queryFn: ({ signal }) => repositories.customer.order(id, signal),
    enabled: enabled && !!id && session?.workspace.kind === 'CUSTOMER',
  });
}

/** Save genuine records for a whole booking; the cache enforces account generations. */
export function useSaveBookingTickets() {
  const { session } = useAuth();
  const cache = useQueryClient();
  return useExclusiveMutation('save-booking-pass', {
    mutationFn: async (tickets: readonly Ticket[], assertCurrent) => {
      if (!session || !tickets.length) throw new Error('Cần tải được vé trước khi lưu.');
      const bookingId = tickets[0]!.bookingId;
      if (tickets.some((ticket) => ticket.bookingId !== bookingId))
        throw new Error('Các vé không cùng một đơn.');
      const downloadedAt = new Date().toISOString();
      for (const ticket of tickets) {
        await assertCurrent();
        await ticketCache.save(session.userId, ticket, downloadedAt);
      }
    },
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ['saved-tickets', ...sessionScope(session)] });
      void cache.invalidateQueries({ queryKey: ['offline-ticket-snapshots', ...sessionScope(session)] });
    },
  });
}
