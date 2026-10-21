import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';
import { ActionFooter, Copy, ErrorNotice, Heading, Notice, QueryState, Screen, ui } from '@/components/ui';
import { MenuRow } from '@/components/customer-controls';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBooking } from '@/features/customer/booking/hooks/use-booking';
import { canPay } from '@/features/customer/booking/booking-presentation';
import { usePayment } from '../hooks/use-payment';
import { customerCapabilities } from '@/lib/capabilities';
import { BookingSummary } from '@/features/customer/booking/components/booking-summary';

function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
  const payment = usePayment(bookingId);
  const [terms, setTerms] = useState(false);
  const booking = query.data;
  const configured = customerCapabilities.gatewayPayment && Boolean(process.env.EXPO_PUBLIC_PAYMENT_GATEWAY);
  return (
    <Screen
      footer={
        <ActionFooter
          busy={payment.isPending}
          disabled={!configured || !terms || !booking || !canPay(booking, query.remainingMs)}
          disabledReason={
            !configured
              ? 'Thanh toán trực tuyến chưa khả dụng.'
              : !booking
                ? 'Cần tải được đơn trước khi thanh toán.'
                : !canPay(booking, query.remainingMs)
                  ? 'Đơn hiện không cho phép thanh toán. Hãy kiểm tra trạng thái mới nhất.'
                  : 'Xác nhận điều khoản trước khi tiếp tục.'
          }
          onPress={() => payment.mutate()}
        >
          Đến cổng thanh toán
        </ActionFooter>
      }
    >
      <Heading>Thanh toán</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {!booking && <BookingSummary />}
      {booking && (
        <>
          <Heading small>{booking.code}</Heading>
          <BookingSummary booking={booking} />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}
            onPress={() => setTerms((p) => !p)}
            style={[ui.card, { minHeight: 56 }]}
          >
            <Copy>{terms ? '☑' : '☐'} Tôi đồng ý điều khoản thanh toán.</Copy>
          </Pressable>
          {booking.status !== 'PENDING' && (
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
