import { useLocalSearchParams, router } from 'expo-router';
import { Button, Card, Heading, QueryState, Screen } from '@/components/ui';
import { DetailRow, Unavailable, UnavailableAction } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBooking } from '@/features/customer/booking/hooks/use-booking';
import { bookingLabels } from '@/features/customer/booking/booking-presentation';
import { Disclosure } from '@/components/customer-controls';
function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
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
        Chưa thể tải chi tiết từng giao dịch và thời điểm nhận tiền. Không thanh toán lại khi chưa có kết quả
        xác nhận.
      </Unavailable>
      <UnavailableAction
        label="Thanh toán lại"
        reason="Chưa có kết quả xác nhận giao dịch thất bại để thanh toán lại."
      />
      <Button busy={query.isRefetching} onPress={() => void query.refetch()}>
        Kiểm tra trạng thái đơn
      </Button>
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
