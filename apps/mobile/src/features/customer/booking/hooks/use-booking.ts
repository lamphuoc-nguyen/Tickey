import { sessionScope } from '@/lib/session-scope';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { repositories } from '@/lib/repositories';
import { countdownRemaining, pollingInterval } from '../booking-presentation';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';

export function useBooking(id: string) {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: ['booking', ...sessionScope(session), id],
    queryFn: async () => ({
      booking: await repositories.booking.getBooking(id),
      receivedAt: performance.now(),
    }),
    enabled: !!session && session.workspace.kind === 'CUSTOMER' && !!id,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (!data) return false;
      return pollingInterval(data.booking, performance.now() - data.receivedAt);
    },
    refetchOnWindowFocus: true,
  });
  const refetch = query.refetch;
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && id && session?.workspace.kind === 'CUSTOMER') void refetch();
    });
    return () => listener.remove();
  }, [refetch, id, session?.workspace.kind]);
  const [clock, setClock] = useState(() => performance.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(performance.now()), 500);
    return () => clearInterval(timer);
  }, []);
  return {
    ...query,
    data: query.data?.booking,
    remainingMs: query.data ? countdownRemaining(query.data.booking, clock - query.data.receivedAt) : 0,
  };
}
export function useCancelBooking() {
  const { session } = useAuth();
  const cache = useQueryClient();
  return useExclusiveMutation('cancel-booking', {
    mutationFn: (id: string) => repositories.booking.cancelBooking(id),
    onSuccess: (booking) => {
      cache.setQueryData(['booking', ...sessionScope(session), booking.id], {
        booking,
        receivedAt: performance.now(),
      });
      void cache.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
