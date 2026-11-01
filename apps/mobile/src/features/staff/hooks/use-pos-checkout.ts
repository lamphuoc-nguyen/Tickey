import type { Booking } from '@event/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { countdownRemaining, pollingInterval } from '@/features/customer/booking/booking-presentation';
import { runCheckout } from '@/features/customer/payment/run-checkout';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';
import { repositories } from '@/lib/repositories';
import { sessionScope } from '@/lib/session-scope';

function useBookingKey(bookingId: string) {
  const { session } = useAuth();
  return ['staff-pos-booking', ...sessionScope(session), bookingId];
}

/** The booking as the server sees it, polled while it can still change. */
export function usePosBooking(bookingId: string) {
  const query = useQuery({
    queryKey: useBookingKey(bookingId),
    queryFn: async () => ({
      booking: await repositories.booking.getBooking(bookingId),
      receivedAt: performance.now(),
    }),
    refetchInterval: (q) => {
      const data = q.state.data;
      return data ? pollingInterval(data.booking, performance.now() - data.receivedAt) : false;
    },
  });
  const [clock, setClock] = useState(() => performance.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(performance.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return {
    ...query,
    data: query.data?.booking,
    remainingMs: query.data ? countdownRemaining(query.data.booking, clock - query.data.receivedAt) : 0,
  };
}

/** The gate QR appears shortly after the booking is confirmed, once the worker has signed it. */
export function usePosAdmission(bookingId: string, enabled: boolean) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['staff-pos-admission', ...sessionScope(session), bookingId],
    queryFn: ({ signal }) => repositories.customer.admission(bookingId, signal),
    enabled,
    refetchInterval: (q) => (q.state.data && !q.state.data.qr ? 3000 : false),
  });
}

function usePublishBooking(bookingId: string) {
  const cache = useQueryClient();
  const key = useBookingKey(bookingId);
  return (booking: Booking) => cache.setQueryData(key, { booking, receivedAt: performance.now() });
}

export function usePosPayment(bookingId: string) {
  const publish = usePublishBooking(bookingId);
  return useExclusiveMutation<{ testMode: boolean }, void>(`pos-payment:${bookingId}`, {
    mutationFn: async (_variables, assertCurrent) => {
      const { testMode } = await runCheckout(bookingId, assertCurrent, publish);
      return { testMode };
    },
  });
}

export function usePosCancel(bookingId: string) {
  const publish = usePublishBooking(bookingId);
  return useExclusiveMutation<Booking, void>(`pos-cancel:${bookingId}`, {
    mutationFn: () => repositories.booking.cancelBooking(bookingId),
    onSuccess: publish,
  });
}
