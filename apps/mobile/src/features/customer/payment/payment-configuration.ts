import { customerCapabilities } from '@/lib/capabilities';
import { paidCheckoutAvailable } from './payment-availability';

export function getPaymentConfiguration() {
  // TEST names the existing signed server confirmation transport, not a client-side preview.
  const available = paidCheckoutAvailable(customerCapabilities.gatewayPayment);
  return {
    gateway: 'TEST',
    isTest: true,
    available,
    unavailableReason: 'Chưa thể xác nhận đặt vé. Vui lòng thử lại sau.',
  };
}
