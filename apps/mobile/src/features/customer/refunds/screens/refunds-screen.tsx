import { formatMoney } from '@event/core';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Copy, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useRefunds } from '@/features/customer/account/hooks/use-customer-data';

export const refundLabels = {
  REQUESTED: 'Đã tiếp nhận yêu cầu hoàn',
  PROCESSING: 'Đang xử lý hoàn',
  SUCCEEDED: 'Đã hoàn thành',
  FAILED: 'Hoàn về phương thức gốc chưa thành công',
  AWAITING_BANK_INFO: 'Cần tài khoản nhận hoàn',
  MANUAL_TRANSFER: 'Đang chờ chuyển khoản được duyệt',
};
export function refundReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    SESSION_CANCELLED: 'Suất diễn bị hủy',
    LATE_PAYMENT_NO_SEAT: 'Thanh toán sau hạn, không còn chỗ',
    DISPUTE: 'Kết quả xử lý phản ánh',
    MANUAL: 'Điều chỉnh được duyệt',
    DUPLICATE_PAYMENT: 'Thanh toán trùng',
    CUSTOMER_REQUEST: 'Yêu cầu của khách hàng',
  };
  return labels[reason] ?? 'Chưa có thông tin lý do';
}
function Content() {
  const query = useRefunds();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const refunds = query.data?.pages.flat().filter((r) => !bookingId || r.bookingId === bookingId) ?? [];
  return (
    <Screen>
      <Heading>Theo dõi hoàn tiền</Heading>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !refunds.length}
        emptyText="Chưa có yêu cầu hoàn tiền trong các đơn đã tải."
      />
      <Notice>
        Tiền ưu tiên hoàn về phương thức thanh toán ban đầu. Chỉ gửi tài khoản ngân hàng khi hệ thống yêu cầu.
      </Notice>
      {refunds.map((refund) => (
        <Card key={refund.id}>
          <Heading small>{refundLabels[refund.status]}</Heading>
          <Copy>{formatMoney(refund.amount)}</Copy>
          <Copy>Lý do: {refundReasonLabel(refund.reason)}</Copy>
          <Copy>Cập nhật: {new Date(refund.updatedAt).toLocaleString('vi-VN')}</Copy>
          <Button
            secondary
            onPress={() => router.push({ pathname: '/refunds/[refundId]', params: { refundId: refund.id } })}
          >
            Chi tiết yêu cầu
          </Button>
          {refund.status === 'AWAITING_BANK_INFO' && (
            <Button
              onPress={() =>
                router.push({ pathname: '/refunds/[refundId]/bank', params: { refundId: refund.id } })
              }
            >
              Bổ sung tài khoản nhận hoàn
            </Button>
          )}
          <Button
            secondary
            onPress={() =>
              router.push({ pathname: '/booking/[bookingId]', params: { bookingId: refund.bookingId } })
            }
          >
            Xem đơn
          </Button>
        </Card>
      ))}
      {query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()}>
          Xem thêm hoàn tiền
        </Button>
      )}
    </Screen>
  );
}
export default function RefundsScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
