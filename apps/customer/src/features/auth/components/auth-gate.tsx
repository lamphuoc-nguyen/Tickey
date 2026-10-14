import type { PropsWithChildren } from 'react';
import { router, usePathname } from 'expo-router';
import { Button, Copy, ErrorNotice, Heading, QueryState, Screen } from '@/components/ui';
import { useAuth } from '../hooks/auth-context';

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuth();
  const next = usePathname();
  if (auth.loading)
    return (
      <Screen>
        <QueryState loading />
      </Screen>
    );
  if (auth.error && !auth.session)
    return (
      <Screen>
        <Heading>Chưa thể xác nhận tài khoản</Heading>
        <QueryState error={auth.error} retry={auth.retry} />
        <Button secondary onPress={() => router.push('/tickets/offline')}>
          Xem vé đã tải khi mất mạng
        </Button>
      </Screen>
    );
  if (!auth.session)
    return (
      <Screen>
        <Heading>Đăng nhập để tiếp tục</Heading>
        <Copy>Quản lý đơn và vé của bạn trong Tickey.</Copy>
        {!!auth.error && <ErrorNotice error={auth.error} />}
        <Button onPress={() => router.push({ pathname: '/auth/login', params: { next } })}>Đăng nhập</Button>
        <Button secondary onPress={() => router.push('/tickets/offline')}>
          Xem vé đã tải khi mất mạng
        </Button>
      </Screen>
    );
  if (auth.session.workspace.kind !== 'CUSTOMER')
    return (
      <Screen>
        <Heading>Chọn không gian Customer</Heading>
        <Button onPress={() => router.push({ pathname: '/workspaces', params: { next } })}>
          Chọn không gian làm việc
        </Button>
      </Screen>
    );
  return children;
}
