import type { PropsWithChildren } from 'react';
import { router, usePathname } from 'expo-router';
import { Button, Copy, ErrorNotice, Heading, QueryState, Screen } from '@/components/ui';
import { useAuth } from '../hooks/auth-context';
import { isStaffWorkspace, type MobileWorkspaceKind } from '../mobile-workspace';

export function AuthGate({ children, kind = 'CUSTOMER' }: PropsWithChildren<{ kind?: MobileWorkspaceKind }>) {
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
        <Copy>
          {kind === 'STAFF'
            ? 'Sử dụng tài khoản đã được tổ chức phân quyền nhân viên.'
            : 'Quản lý đơn và vé của bạn trong Tickey.'}
        </Copy>
        {!!auth.error && <ErrorNotice error={auth.error} />}
        <Button onPress={() => router.push({ pathname: '/auth/login', params: { next } })}>Đăng nhập</Button>
        <Button secondary onPress={() => router.push('/tickets/offline')}>
          Xem vé đã tải khi mất mạng
        </Button>
      </Screen>
    );
  if (auth.session.workspace.kind !== kind)
    return (
      <Screen>
        <Heading>Kiểm tra quyền truy cập</Heading>
        <Copy>Tiếp tục đến khu vực được phân quyền cho tài khoản của bạn.</Copy>
        <Button onPress={() => router.push({ pathname: '/workspaces', params: { next } })}>
          Tiếp tục với tài khoản
        </Button>
        {isStaffWorkspace(auth.session.workspace) && (
          <Button secondary onPress={() => router.replace('/staff')}>
            Về khu vực nhân viên
          </Button>
        )}
      </Screen>
    );
  if (kind === 'STAFF' && !isStaffWorkspace(auth.session.workspace))
    return (
      <Screen navigationEnabled={false}>
        <Heading>Chưa thể xác nhận quyền nhân viên</Heading>
        <Copy>Vui lòng chọn lại tổ chức hoặc liên hệ người quản lý để kiểm tra quyền truy cập.</Copy>
        <Button onPress={() => router.replace('/workspaces')}>Kiểm tra tổ chức được phân quyền</Button>
      </Screen>
    );
  return children;
}
