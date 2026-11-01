import { router, useLocalSearchParams } from 'expo-router';
import { ActionFooter, Copy, ErrorNotice, Heading, Notice, QueryState, Screen, ui } from '@/components/ui';
import { MenuRow } from '@/components/customer-controls';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBooking } from '@/features/customer/booking/hooks/use-booking';
import { canPay } from '@/features/customer/booking/booking-presentation';
import { usePayment } from '../hooks/use-payment';
import { getPaymentConfiguration } from '../payment-configuration';
import { BookingSummary } from '@/features/customer/booking/components/booking-summary';
import { BuyerInfo } from '@/features/customer/booking/components/buyer-info';

function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
  const payment = usePayment(bookingId);
  const booking = query.data;
  const configuration = getPaymentConfiguration();
  const configured = configuration.available;
  return (
    <Screen
      footer={
        <ActionFooter
          busy={payment.isPending}
          disabled={!configured || !booking || !!query.error || !canPay(booking, query.remainingMs)}
          disabledReason={
            !configured
              ? configuration.unavailableReason
              : !booking
                ? 'Cần tải được đơn trước khi thanh toán.'
                : query.error
                  ? 'Cần cập nhật trạng thái đơn trước khi thanh toán.'
                  : 'Đơn hiện không cho phép thanh toán. Hãy kiểm tra trạng thái mới nhất.'
          }
          onPress={() => payment.mutate()}
        >
          Thanh toán
        </ActionFooter>
      }
    >
      <Heading>Thanh toán</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {!booking && <BookingSummary />}
      {booking && (
        <>
          <Copy style={ui.muted}>Mã đơn: {booking.code}</Copy>
          <BookingSummary booking={booking} compact />
          <BuyerInfo />
          {booking.status !== 'PENDING' && booking.status !== 'PAYMENT_PENDING' && (
            <Notice>Đơn đã đổi trạng thái. Mở đơn để xem kết quả mới nhất.</Notice>
          )}
          {!!payment.error && <ErrorNotice error={payment.error} />}
          <MenuRow
            label="Chi tiết đơn"
            onPress={() => router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } })}
          />
        </>
      )}
    </Screen>
  );
}
export default function PaymentScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
