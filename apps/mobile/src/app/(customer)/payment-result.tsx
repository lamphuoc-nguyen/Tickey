import { Redirect, useLocalSearchParams } from 'expo-router';
import { paymentReturnDestination } from '@/features/customer/payment/payment-return';
export default function PaymentReturnRoute() {
  const { booking_id } = useLocalSearchParams<{ booking_id?: string }>();
  return <Redirect href={paymentReturnDestination(booking_id)} />;
}
