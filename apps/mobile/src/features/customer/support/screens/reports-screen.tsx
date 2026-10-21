import { router } from 'expo-router';
import { Button, Heading, QueryState, Screen } from '@/components/ui';
import { MenuGroup, MenuRow } from '@/components/customer-controls';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useReports } from '@/features/customer/account/hooks/use-customer-data';
import { reportCategoryLabels, visibleStatus } from '../presentation';
function Content() {
  const query = useReports();
  const reports = query.data?.pages.flat() ?? [];
  return (
    <Screen>
      <Heading>Phản ánh của tôi</Heading>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !reports.length}
        emptyText="Chưa có phản ánh."
      />
      <MenuGroup>
        {reports.map((report) => (
          <MenuRow
            key={report.id}
            label={reportCategoryLabels[report.category] ?? 'Phản ánh'}
            description={report.description}
            status={visibleStatus(report.status)}
            onPress={() => router.push({ pathname: '/reports/[reportId]', params: { reportId: report.id } })}
          />
        ))}
      </MenuGroup>
      {query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()}>
          Xem thêm phản ánh
        </Button>
      )}
      <Button onPress={() => router.push('/tickets')}>Chọn vé để gửi phản ánh</Button>
    </Screen>
  );
}
export default function ReportsScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
