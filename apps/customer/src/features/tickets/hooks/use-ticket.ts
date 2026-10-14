import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { repositories } from '@/lib/repositories';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { ticketCache } from '../ticket-cache-instance';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';

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
    queryKey: ['saved-tickets', session?.userId],
    queryFn: () => ticketCache.list(session!.userId),
    enabled: !!session,
  });
}
export function useTicket(id: string) {
  const { session } = useAuth();
  const online = useConnection();
  const cache = useQueryClient();
  const saved = useSavedTickets();
  const query = useQuery({
    queryKey: ['ticket', session?.userId, id],
    queryFn: async ({ signal }) => {
      const ticket = await repositories.customer.ticket(id, signal);
      if (session && (await ticketCache.list(session.userId)).some((saved) => saved.ticket.id === id)) {
        await ticketCache.save(session.userId, ticket, new Date().toISOString());
        void cache.invalidateQueries({ queryKey: ['saved-tickets', session.userId] });
      }
      return ticket;
    },
    enabled: online && !!session && session.workspace.kind === 'CUSTOMER' && !!id,
    refetchOnWindowFocus: true,
  });
  const refetch = query.refetch;
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && online && session?.workspace.kind === 'CUSTOMER') void refetch();
    });
    return () => listener.remove();
  }, [refetch, online, session?.workspace.kind]);
  const download = useMutation({
    mutationFn: async () => {
      if (!session || !query.data || !online) throw new Error('Cần tải vé mới từ máy chủ.');
      await ticketCache.save(session.userId, query.data, new Date().toISOString());
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: ['saved-tickets', session?.userId] }),
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
  return useQuery({
    queryKey: ['offline-ticket-snapshots'],
    queryFn: async () => {
      const userId = await ticketCache.lastAccount();
      return userId ? ticketCache.list(userId) : [];
    },
    networkMode: 'always',
  });
}
export function useBookingTickets(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['booking-tickets', session?.userId, id],
    queryFn: ({ signal }) => repositories.customer.bookingTickets(id, signal),
    enabled: !!id && session?.workspace.kind === 'CUSTOMER',
  });
}
export function useOrder(id: string) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['order', session?.userId, id],
    queryFn: ({ signal }) => repositories.customer.order(id, signal),
    enabled: !!id && session?.workspace.kind === 'CUSTOMER',
  });
}
