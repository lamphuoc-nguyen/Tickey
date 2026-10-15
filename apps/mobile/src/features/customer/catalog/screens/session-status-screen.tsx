import { router, useLocalSearchParams } from 'expo-router';
import { Button, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { useAvailability } from '../hooks/use-catalog';
export default function SessionStatusScreen() {
  const { sessionId = '', eventId } = useLocalSearchParams<{ sessionId: string; eventId?: string }>();
  const query = useAvailability(sessionId);
  const paused = query.data?.salesPaused,
    cancelled = query.data?.sessionStatus === 'CANCELLED';
  return (
    <Screen>
      <Heading>
        {paused ? 'Suất đang tạm dừng bán' : cancelled ? 'Suất diễn đã bị hủy' : 'Thông tin bán vé'}
      </Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {query.data && (
        <Notice warning>
          {paused
            ? 'Chưa thể đặt thêm vé. Theo dõi thông báo hoặc chọn một suất khác đang bán.'
            : cancelled
              ? 'Suất này đã bị hủy và không còn bán vé.'
              : 'Trạng thái suất được xác nhận khi bạn đặt vé.'}
        </Notice>
      )}
      <Button
        onPress={() =>
          eventId
            ? router.replace({ pathname: '/events/[eventId]/sessions', params: { eventId } })
            : router.replace('/')
        }
      >
        Chọn suất khác
      </Button>
    </Screen>
  );
}
