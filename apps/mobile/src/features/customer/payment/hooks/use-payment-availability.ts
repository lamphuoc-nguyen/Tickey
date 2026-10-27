import { customerCapabilities } from '@/lib/capabilities';
import { paidCheckoutAvailable } from '../payment-availability';

export function usePaymentAvailability() {
  return paidCheckoutAvailable(customerCapabilities.gatewayPayment, process.env.EXPO_PUBLIC_PAYMENT_GATEWAY);
}
