import { sessionScope } from '@/lib/session-scope';
import type { Booking } from '@event/core';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { router } from 'expo-router';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';
import { runCheckout } from '../run-checkout';

export function usePayment(bookingId: string) {
  const cache = useQueryClient();
  const { session } = useAuth();
  return useExclusiveMutation<Booking, void>(`payment:${bookingId}`, {
    retry: false,
    mutationFn: async (_variables, assertCurrent) => {
      const { booking } = await runCheckout(bookingId, assertCurrent, (latest) => {
        cache.setQueryData(['booking', ...sessionScope(session), bookingId], {
          booking: latest,
          receivedAt: performance.now(),
        });
        void cache.invalidateQueries({ queryKey: ['orders'] });
        for (const resource of ['order', 'booking-tickets', 'booking-admission'])
          void cache.invalidateQueries({ queryKey: [resource, ...sessionScope(session), bookingId] });
        void cache.invalidateQueries({ queryKey: ['tickets', ...sessionScope(session)] });
      });
      return booking;
    },
    onSuccess: (booking) =>
      router.replace({
        pathname: ['PAID', 'CONFIRMED'].includes(booking.status)
          ? '/booking/[bookingId]/result'
          : '/booking/[bookingId]',
        params: { bookingId },
      }),
  });
}
