import { router } from 'expo-router';
import { Button, Copy, ErrorNotice, Heading, Screen } from '@/components/ui';
import { useAuthActions } from '../hooks/use-auth-actions';

export default function AccessInfoScreen() {
  const { logout } = useAuthActions();
  return (
    <Screen contentStyle={{ paddingTop: 70 }}>
      <Heading>Tài khoản này dùng trên web</Heading>
      <Copy>Đăng nhập Tickey Web để quản lý tổ chức hoặc nền tảng.</Copy>
      <Button
        busy={logout.isPending}
        onPress={() =>
          void logout
            .mutateAsync()
            .then(() => router.replace('/auth/login'))
            .catch(() => {})
        }
      >
        Đăng nhập tài khoản khác
      </Button>
      {!!logout.error && <ErrorNotice error={logout.error} />}
    </Screen>
  );
}
