import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';
import {
  ActionFooter,
  Button,
  Copy,
  ErrorNotice,
  Heading,
  Notice,
  QueryState,
  Screen,
  ui,
} from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBooking } from '@/features/booking/hooks/use-booking';
import { canPay } from '@/features/booking/booking-presentation';
import { usePayment } from '../hooks/use-payment';
import { customerCapabilities } from '@/lib/capabilities';
import { BookingSummary } from '@/features/booking/components/booking-summary';

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
              ? 'Thanh toán trực tuyến chưa khả dụng. Bạn có thể về đơn hoặc liên hệ hỗ trợ.'
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
          <Notice>
            Kết quả thanh toán được xác nhận trước khi phát hành vé. Mỗi người sử dụng một vé riêng.
          </Notice>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}
            onPress={() => setTerms((p) => !p)}
            style={[ui.card, { minHeight: 56 }]}
          >
            <Copy>{terms ? '✓' : '○'} Tôi đã kiểm tra đơn và đồng ý điều khoản thanh toán.</Copy>
          </Pressable>
          {!configured && (
            <Notice warning>Thanh toán đang được cấu hình. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.</Notice>
          )}
          {booking.status !== 'PENDING' && (
            <Notice>Đơn đã đổi trạng thái. Mở đơn để xem kết quả mới nhất.</Notice>
          )}
          {!!payment.error && <ErrorNotice error={payment.error} />}
          <Button
            secondary
            onPress={() => router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } })}
          >
            Quay về và kiểm tra đơn
          </Button>
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
