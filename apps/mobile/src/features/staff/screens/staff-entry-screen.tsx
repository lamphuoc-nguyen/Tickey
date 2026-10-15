import { router } from 'expo-router';
import { Button, Card, Copy, ErrorNotice, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { useAuth } from '../../auth/hooks/auth-context';
import { useAuthActions } from '../../auth/hooks/use-auth-actions';
import StaffHomeScreen from './staff-home-screen';

const staffRoleNames: Record<string, string> = {
  SCANNER: 'Kiểm soát vé',
  POS: 'Bán vé tại quầy',
  GATE_MANAGER: 'Quản lý cổng',
};

/** Shared app integration point. Operational Staff screens are not implemented in this checkout. */
function Content() {
  const { session } = useAuth();
  const actions = useAuthActions();
  const organization = actions.workspaces.data?.find(
    (workspace) => workspace.kind === 'STAFF' && workspace.orgId === session?.workspace.orgId,
  );
  const roles = session?.workspace.roles.filter((role) => staffRoleNames[role]) ?? [];
  return (
    <Screen back={false} navigationEnabled={false}>
      <StaffHomeScreen />
      <Copy>{session?.email}</Copy>
      <QueryState
        loading={actions.workspaces.isPending}
        error={actions.workspaces.error}
        retry={() => void actions.workspaces.refetch()}
        empty={actions.workspaces.isSuccess && !organization}
        emptyText="Chưa thể xác nhận tổ chức đang phân quyền. Vui lòng chọn lại tổ chức làm việc."
      />
      <Card>
        <Heading small>{organization?.orgName ?? 'Chưa thể tải thông tin tổ chức'}</Heading>
        <Copy>{roles.map((role) => staffRoleNames[role]).join(' · ')}</Copy>
        <Notice>
          Các chức năng ca làm hiện chưa khả dụng. Liên hệ người quản lý nếu cần hỗ trợ.
        </Notice>
      </Card>
      {[
        ['Quét vé', 'Chức năng quét vé hiện chưa sẵn sàng.'],
        ['Tra cứu và kiểm soát vé', 'Chức năng kiểm soát vé hiện chưa sẵn sàng.'],
        ['Bán vé tại quầy', 'Chức năng bán vé tại quầy hiện chưa sẵn sàng.'],
      ].map(([label, reason]) => (
        <Button key={label} disabled disabledReason={reason} onPress={() => {}}>
          {label}
        </Button>
      ))}
      <Button secondary onPress={() => router.push('/staff/workspaces')}>
        Đổi tổ chức làm việc
      </Button>
      <Button
        secondary
        busy={actions.logout.isPending}
        onPress={() =>
          void actions.logout
            .mutateAsync()
            .then(() => router.replace('/auth/login'))
            .catch(() => {})
        }
      >
        Đăng xuất
      </Button>
      {!!actions.logout.error && <ErrorNotice error={actions.logout.error} />}
    </Screen>
  );
}

export default function StaffEntryScreen() {
  return <Content />;
}
