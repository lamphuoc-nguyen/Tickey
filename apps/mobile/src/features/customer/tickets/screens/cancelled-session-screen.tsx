import { router, useLocalSearchParams } from 'expo-router';
import { Button, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useTicket } from '../hooks/use-ticket';
function Content() {
  const { ticketId = '' } = useLocalSearchParams<{ ticketId: string }>();
  const { ticket, query, online, saved } = useTicket(ticketId);
  const cancelled = ticket?.session?.status === 'CANCELLED';
  return (
    <Screen>
      <Heading>
        {cancelled ? `${ticket?.session?.title ?? 'Suất diễn'} đã hủy` : 'Thông tin suất diễn'}
      </Heading>
      <QueryState
        loading={online ? query.isPending : saved.isPending}
        error={online ? query.error : saved.error}
        retry={() => void query.refetch()}
      />
      {cancelled ? (
        <Notice warning>
          Không dùng vé này để vào cổng. Theo dõi trạng thái hoàn tiền của đơn bị ảnh hưởng; các suất khác
          được xử lý riêng.
        </Notice>
      ) : (
        <Notice>Chưa có thông tin xác nhận suất diễn bị hủy.</Notice>
      )}
      <Button
        disabled={!ticket}
        disabledReason="Cần tải được vé để xác định đơn liên quan."
        onPress={() =>
          ticket && router.push({ pathname: '/refunds', params: { bookingId: ticket.bookingId } })
        }
      >
        Theo dõi hoàn tiền
      </Button>
      <Button
        secondary
        disabled={!ticket?.session?.event?.id}
        disabledReason="Chưa có thông tin sự kiện để chọn suất khác."
        onPress={() =>
          ticket?.session?.event?.id &&
          router.push({
            pathname: '/events/[eventId]/sessions',
            params: { eventId: ticket.session.event.id },
          })
        }
      >
        Suất khác
      </Button>
      <Button secondary onPress={() => router.back()}>
        Quay lại
      </Button>
    </Screen>
  );
}
export default function CancelledSessionScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
