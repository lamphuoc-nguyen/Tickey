import { router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';
import { ActionFooter, Copy, ErrorNotice, Heading, Notice, QueryState, Screen, ui } from '@/components/ui';
import { MenuRow } from '@/components/customer-controls';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBooking } from '@/features/customer/booking/hooks/use-booking';
import { canPay } from '@/features/customer/booking/booking-presentation';
import { usePayment } from '../hooks/use-payment';
import { usePaymentAvailability } from '../hooks/use-payment-availability';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { BookingSummary } from '@/features/customer/booking/components/booking-summary';
import { BuyerInfo } from '@/features/customer/booking/components/buyer-info';

function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
  const payment = usePayment(bookingId);
  const { draft, update } = useFormDraft(`payment:${bookingId}`, { terms: false });
  const terms = draft.terms;
  const booking = query.data;
  const configured = usePaymentAvailability();
  return (
    <Screen
      footer={
        <ActionFooter
          busy={payment.isPending}
          disabled={!configured || !terms || !booking || !!query.error || !canPay(booking, query.remainingMs)}
          disabledReason={
            !configured
              ? 'Thanh toán trực tuyến chưa khả dụng.'
              : !booking
                ? 'Cần tải được đơn trước khi thanh toán.'
                : query.error
                  ? 'Cần cập nhật trạng thái đơn trước khi thanh toán.'
                  : !canPay(booking, query.remainingMs)
                    ? 'Đơn hiện không cho phép thanh toán. Hãy kiểm tra trạng thái mới nhất.'
                    : 'Xác nhận điều khoản trước khi tiếp tục.'
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
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}
            onPress={() => update({ terms: !terms })}
            style={[ui.card, { minHeight: 56 }]}
          >
            <Copy>{terms ? '☑' : '☐'} Tôi đồng ý điều khoản thanh toán.</Copy>
          </Pressable>
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
