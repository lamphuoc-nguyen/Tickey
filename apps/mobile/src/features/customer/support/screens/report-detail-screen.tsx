import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Copy, Heading, QueryState, Screen } from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useReport } from '../hooks/use-support-actions';
import { DetailRow, Unavailable } from '@/components/detail';
import { reportCategoryLabels, visibleStatus } from '../presentation';
function Content() {
  const { reportId = '' } = useLocalSearchParams<{ reportId: string }>();
  const query = useReport(reportId);
  return (
    <Screen>
      <Heading>Chi tiết phản ánh</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {query.data && (
        <Card>
          <DetailRow label="Trạng thái" value={visibleStatus(query.data.status)} />
          <DetailRow
            label="Loại vấn đề"
            value={reportCategoryLabels[query.data.category] ?? 'Chưa có thông tin'}
          />
          <Copy>{query.data.description}</Copy>
          <Copy>Cập nhật: {new Date(query.data.updatedAt).toLocaleString('vi-VN')}</Copy>
          <DetailRow label="Phản hồi" />
          <Unavailable>Chưa thể tải phản hồi và lịch sử bằng chứng cho phản ánh này.</Unavailable>
          <Button
            secondary
            onPress={() => router.push({ pathname: '/reports/[reportId]/supplement', params: { reportId } })}
          >
            Bổ sung phản ánh · Chưa hỗ trợ
          </Button>
        </Card>
      )}
      <Button secondary onPress={() => router.push('/support')}>
        Liên hệ hỗ trợ
      </Button>
    </Screen>
  );
}
export default function ReportDetailScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
