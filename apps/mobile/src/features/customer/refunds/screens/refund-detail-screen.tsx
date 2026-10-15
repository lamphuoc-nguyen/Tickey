import { formatMoney } from '@event/core';
import { useLocalSearchParams, router } from 'expo-router';
import { ActionFooter, Button, Card, Copy, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { DetailRow, UnavailableAction } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useRefund } from '@/features/customer/support/hooks/use-support-actions';
import { refundLabels, refundReasonLabel } from './refunds-screen';
function Content() {
  const { refundId = '' } = useLocalSearchParams<{ refundId: string }>();
  const query = useRefund(refundId),
    refund = query.data;
  return (
    <Screen footer={<ActionFooter onPress={() => router.replace('/refunds')}>Theo dõi yêu cầu</ActionFooter>}>
      <Heading>
        {refund?.status === 'REQUESTED' ? 'Yêu cầu hoàn đã được tiếp nhận' : 'Theo dõi hoàn tiền'}
      </Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      <Notice warning>
        {refund ? refundLabels[refund.status] : 'Chưa có thông tin trạng thái hoàn tiền.'}
      </Notice>
      <Card>
        <DetailRow label="Trạng thái" value={refund ? refundLabels[refund.status] : null} />
        <DetailRow label="Số tiền" value={refund ? formatMoney(refund.amount) : null} />
        <DetailRow label="Lý do" value={refund ? refundReasonLabel(refund.reason) : null} />
        <DetailRow
          label="Thời điểm tiếp nhận"
          value={refund ? new Date(refund.createdAt).toLocaleString('vi-VN') : null}
        />
      </Card>
      <Copy>
        Tiền ưu tiên hoàn về phương thức thanh toán ban đầu. Chỉ gửi tài khoản ngân hàng khi được yêu cầu.
      </Copy>
      {refund?.status === 'AWAITING_BANK_INFO' ? (
        <Button onPress={() => router.push({ pathname: '/refunds/[refundId]/bank', params: { refundId } })}>
          Bổ sung tài khoản nhận hoàn
        </Button>
      ) : (
        <UnavailableAction
          label="Bổ sung tài khoản"
          reason="Yêu cầu hiện không cần bổ sung tài khoản ngân hàng."
        />
      )}
      <UnavailableAction
        label="Khiếu nại quyết định"
        reason="Khiếu nại quyết định hoàn tiền chưa được hỗ trợ. Bạn có thể liên hệ hỗ trợ."
      />
      {refund && (
        <Button
          secondary
          onPress={() =>
            router.push({ pathname: '/booking/[bookingId]', params: { bookingId: refund.bookingId } })
          }
        >
          Xem đơn và vé
        </Button>
      )}
      <Button secondary onPress={() => router.push('/support')}>
        Liên hệ hỗ trợ
      </Button>
    </Screen>
  );
}
export default function RefundDetailScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
