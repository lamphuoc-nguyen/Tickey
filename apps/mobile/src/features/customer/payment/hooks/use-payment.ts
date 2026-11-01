import { sessionScope } from '@/lib/session-scope';
import { ApiError, type Booking } from '@event/core';
import { useQueryClient } from '@tanstack/react-query';
import { repositories } from '@/lib/repositories';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { router } from 'expo-router';
import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';
import { getPaymentConfiguration } from '../payment-configuration';
import { openPaymentBrowser } from '../open-payment-browser';

export function usePayment(bookingId: string) {
  const cache = useQueryClient();
  const { session } = useAuth();
  return useExclusiveMutation<Booking, void>(`payment:${bookingId}`, {
    retry: false,
    mutationFn: async (_variables, assertCurrent) => {
      const configuration = getPaymentConfiguration();
      const gateway = configuration.gateway;
      if (!configuration.available || !gateway) throw new Error(configuration.unavailableReason);
      let failure: unknown;
      try {
        const payment = await repositories.payment.createPaymentSession(bookingId, gateway);
        await assertCurrent();
        if (configuration.isTest) await repositories.payment.confirmTestPayment(payment);
        else await openPaymentBrowser(payment.paymentUrl);
      } catch (error) {
        failure = error;
      }
      // Only server status resolves an uncertain write (including a failed app-scheme redirect).
      await assertCurrent();
      const booking = await repositories.booking.getBooking(bookingId);
      await assertCurrent();
      cache.setQueryData(['booking', ...sessionScope(session), bookingId], {
        booking,
        receivedAt: performance.now(),
      });
      void cache.invalidateQueries({ queryKey: ['orders'] });
      for (const resource of ['order', 'booking-tickets', 'booking-admission'])
        void cache.invalidateQueries({ queryKey: [resource, ...sessionScope(session), bookingId] });
      void cache.invalidateQueries({ queryKey: ['tickets', ...sessionScope(session)] });
      const recorded = booking.status === 'PAID' || booking.status === 'CONFIRMED';
      const uncertainTestResult =
        configuration.isTest && failure instanceof ApiError && failure.code === 'NETWORK';
      if (failure && !(uncertainTestResult && recorded)) throw failure;
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
