import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { repositories } from '@/lib/repositories';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { router } from 'expo-router';
import { customerCapabilities } from '@/lib/capabilities';

export function usePayment(bookingId: string) {
  const cache = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    retry: false,
    mutationFn: async () => {
      const gateway = process.env.EXPO_PUBLIC_PAYMENT_GATEWAY;
      if (!customerCapabilities.gatewayPayment) throw new Error('Thanh toán trực tuyến chưa khả dụng.');
      if (!gateway) throw new Error('Chưa cấu hình cổng thanh toán.');
      try {
        const payment = await repositories.payment.createPaymentSession(bookingId, gateway);
        await WebBrowser.openAuthSessionAsync(payment.paymentUrl, Linking.createURL('/payment-result'));
      } finally {
        // Closing the browser and a return-link status are never evidence of payment success/failure.
        const booking = await repositories.booking.getBooking(bookingId);
        cache.setQueryData(['booking', session?.userId, bookingId], {
          booking,
          receivedAt: performance.now(),
        });
        void cache.invalidateQueries({ queryKey: ['orders'] });
      }
    },
    onSuccess: () => router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } }),
  });
}
