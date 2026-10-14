import { router } from 'expo-router';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { Button, Card, Copy, ErrorNotice, Heading, QueryState, Screen, ui } from '@/components/ui';
import { TabBar } from '@/components/tab-bar';
import { useProfile } from '../hooks/use-customer-data';
import { ProfileIdentity } from '../components/profile-identity';
function Content() {
  const profile = useProfile(),
    actions = useAuthActions();
  return (
    <Screen back={false} footer={<TabBar current="/profile" />}>
      <Heading>Tài khoản</Heading>
      <QueryState loading={profile.isPending} error={profile.error} retry={() => void profile.refetch()} />
      <ProfileIdentity profile={profile.data} />
      <Card>
        <Copy style={ui.semibold}>Thông tin cá nhân</Copy>
        <Copy style={ui.muted}>Cập nhật tên và số điện thoại</Copy>
        <Button secondary onPress={() => router.push('/profile/edit')}>
          Chỉnh sửa hồ sơ
        </Button>
      </Card>
      <Card>
        <Copy style={ui.semibold}>Nhắc lịch & thông báo</Copy>
        <Copy style={ui.muted}>Quản lý tùy chọn</Copy>
      </Card>
      <Card>
        <Copy>Vai trò đang sử dụng</Copy>
        <Copy>Khách hàng</Copy>
      </Card>
      <Button secondary onPress={() => router.push('/profile/preferences')}>
        Tùy chọn thông báo
      </Button>
      <Button
        secondary
        busy={actions.logout.isPending}
        onPress={() =>
          void actions.logout
            .mutateAsync()
            .then(() => router.replace('/'))
            .catch(() => {})
        }
      >
        Đăng xuất
      </Button>
      {!!actions.logout.error && <ErrorNotice error={actions.logout.error} />}
      <Button secondary onPress={() => router.push('/support')}>
        Liên hệ hỗ trợ
      </Button>
      <Button secondary onPress={() => router.push('/reports')}>
        Phản ánh của tôi
      </Button>
      <Button secondary onPress={() => router.push('/refunds')}>
        Theo dõi hoàn tiền
      </Button>
      <Button secondary onPress={() => router.push('/workspaces')}>
        Đổi vai trò sử dụng
      </Button>
    </Screen>
  );
}
export default function ProfileScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
