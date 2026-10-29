import { router, useLocalSearchParams } from 'expo-router';
import { Button, Heading, QueryState } from '@/components/ui';
import { CustomerBrowseScreen } from '@/components/customer-browse-screen';
import { MenuGroup, MenuRow } from '@/components/customer-controls';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useSupport } from '@/features/customer/account/hooks/use-customer-data';
import { visibleStatus } from '../presentation';

function Content() {
  const query = useSupport();
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const rows = query.data?.pages.flat() ?? [];
  return (
    <CustomerBrowseScreen tab="/profile">
      <Heading>Yêu cầu hỗ trợ</Heading>
      <Button
        onPress={() => router.push({ pathname: '/support/new', params: bookingId ? { bookingId } : {} })}
      >
        Gửi yêu cầu mới
      </Button>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !rows.length}
        emptyText="Bạn chưa có yêu cầu hỗ trợ."
      />
      <MenuGroup>
        {rows.map((request) => (
          <MenuRow
            key={request.id}
            label={request.subject}
            status={visibleStatus(request.status)}
            onPress={() =>
              router.push({ pathname: '/support/[requestId]', params: { requestId: request.id } })
            }
          />
        ))}
      </MenuGroup>
      {query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()}>
          Xem thêm yêu cầu
        </Button>
      )}
    </CustomerBrowseScreen>
  );
}

export default function SupportScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
