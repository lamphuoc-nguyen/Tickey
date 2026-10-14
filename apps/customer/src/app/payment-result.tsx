import { Redirect, useLocalSearchParams } from 'expo-router';
export default function PaymentReturnRoute() {
  const { booking_id } = useLocalSearchParams<{ booking_id?: string }>();
  return /^[0-9a-f-]{36}$/i.test(booking_id ?? '') ? (
    <Redirect href={{ pathname: '/booking/[bookingId]', params: { bookingId: booking_id! } }} />
  ) : (
    <Redirect href="/orders" />
  );
}
