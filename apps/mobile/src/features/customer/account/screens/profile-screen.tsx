import { router } from 'expo-router';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { ErrorNotice, Heading, QueryState, Screen } from '@/components/ui';
import { MenuGroup, MenuRow, TextAction } from '@/components/customer-controls';
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
      <MenuGroup title="Cá nhân">
        <MenuRow icon="account" label="Chỉnh sửa hồ sơ" onPress={() => router.push('/profile/edit')} />
        <MenuRow
          icon="notifications"
          label="Nhắc lịch & thông báo"
          onPress={() => router.push('/profile/preferences')}
        />
      </MenuGroup>
      <MenuGroup title="Hỗ trợ">
        <MenuRow label="Liên hệ hỗ trợ" onPress={() => router.push('/support')} />
        <MenuRow label="Phản ánh của tôi" onPress={() => router.push('/reports')} />
        <MenuRow label="Theo dõi hoàn tiền" onPress={() => router.push('/refunds')} />
      </MenuGroup>
      <TextAction
        busy={actions.logout.isPending}
        onPress={() =>
          void actions.logout
            .mutateAsync()
            .then(() => router.replace('/'))
            .catch(() => {})
        }
      >
        Đăng xuất
      </TextAction>
      {!!actions.logout.error && <ErrorNotice error={actions.logout.error} />}
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
