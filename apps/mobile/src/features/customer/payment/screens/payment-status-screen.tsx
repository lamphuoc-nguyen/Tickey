import { useLocalSearchParams, router } from 'expo-router';
import { Button, Card, Heading, QueryState, Screen } from '@/components/ui';
import { DetailRow, Unavailable } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBooking } from '@/features/customer/booking/hooks/use-booking';
import { bookingLabels, canPay } from '@/features/customer/booking/booking-presentation';
import { Disclosure, TextAction } from '@/components/customer-controls';
import { usePaymentAvailability } from '../hooks/use-payment-availability';
function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
  const available = usePaymentAvailability();
  const resumable = !!query.data && !query.error && canPay(query.data, query.remainingMs);
  return (
    <Screen
      footer={
        <Button
          secondary
          onPress={() => router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } })}
        >
          Về đơn
        </Button>
      }
    >
      <Heading>Thông tin giao dịch</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      <Card>
        <DetailRow label="Đơn" value={query.data?.code} />
        <DetailRow label="Trạng thái đơn" value={query.data ? bookingLabels[query.data.status] : null} />
      </Card>
      <Disclosure title="Chi tiết giao dịch">
        <DetailRow label="Kết quả thanh toán" />
        <DetailRow label="Mã tham chiếu" />
        <DetailRow label="Thời điểm nhận tiền" />
      </Disclosure>
      <Unavailable>
        Chưa có thông tin chi tiết của từng giao dịch. Trạng thái đơn được cập nhật riêng ở trên.
      </Unavailable>
      {resumable && (
        <Button
          disabled={!available}
          disabledReason="Thanh toán trực tuyến chưa khả dụng."
          onPress={() => router.replace({ pathname: '/booking/[bookingId]/payment', params: { bookingId } })}
        >
          Tiếp tục thanh toán
        </Button>
      )}
      <Button secondary={resumable} busy={query.isRefetching} onPress={() => void query.refetch()}>
        Kiểm tra trạng thái đơn
      </Button>
      <TextAction onPress={() => router.push({ pathname: '/support', params: { bookingId } })}>
        Liên hệ hỗ trợ
      </TextAction>
    </Screen>
  );
}
export default function PaymentStatusScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
