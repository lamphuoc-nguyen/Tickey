import type { PropsWithChildren } from 'react';
import { Redirect, router, usePathname } from 'expo-router';
import { Button, Copy, Heading, QueryState, Screen } from '@/components/ui';
import { useMobileAccess } from '@/features/auth/hooks/use-mobile-access';
import WorkspaceScreen from '@/features/auth/screens/workspace-screen';
import { staffAccess } from '../staff-access';

export function StaffGate({ children }: PropsWithChildren) {
  const { auth, actions, access: mobile } = useMobileAccess();
  const next = usePathname();
  const access = staffAccess({
    session: auth.session,
    authLoading: auth.loading,
    authError: auth.error,
    membershipPending: actions.workspaces.isPending,
    membershipError: actions.workspaces.error,
    workspaces: actions.workspaces.data,
  });
  if (mobile === 'customer') return <Redirect href="/" />;
  if (access === 'allowed') return children;
  if (access === 'select-workspace') return <WorkspaceScreen staffOnly returnPath={next} />;
  if (access === 'revoked' && next === '/staff/workspaces')
    return <WorkspaceScreen staffOnly returnPath="/staff" />;
  return (
    <Screen back={false} navigationEnabled={false}>
      {access === 'loading' || access === 'error' ? (
        <>
          <Heading>Kiểm tra quyền nhân viên</Heading>
          <QueryState
            loading={access === 'loading'}
            error={auth.error ?? actions.workspaces.error}
            retry={() => (auth.error ? auth.retry() : void actions.workspaces.refetch())}
          />
        </>
      ) : access === 'unauthenticated' ? (
        <>
          <Heading>Đăng nhập để tiếp tục</Heading>
          <Copy>Sử dụng tài khoản đã được tổ chức phân quyền nhân viên.</Copy>
          <Button onPress={() => router.push({ pathname: '/auth/login', params: { next } })}>
            Đăng nhập
          </Button>
        </>
      ) : (
        <>
          <Heading>
            {access === 'revoked' ? 'Quyền nhân viên đã thay đổi' : 'Chưa có quyền nhân viên'}
          </Heading>
          <Copy>
            {access === 'revoked'
              ? 'Bạn không còn quyền truy cập nhân viên tại tổ chức này. Liên hệ người quản lý để kiểm tra quyền truy cập.'
              : 'Liên hệ người quản lý tổ chức để kiểm tra quyền truy cập.'}
          </Copy>
          {access === 'revoked' && (
            <Button secondary onPress={() => router.push('/staff/workspaces')}>
              Chọn tổ chức khác
            </Button>
          )}
        </>
      )}
      {access === 'unauthenticated' ? (
        <Button secondary onPress={() => router.replace('/')}>Khám phá sự kiện</Button>
      ) : auth.session ? (
        <Button secondary busy={actions.logout.isPending}
          onPress={() => void actions.logout.mutateAsync().then(() => router.replace('/auth/login')).catch(() => {})}>
          Đăng xuất
        </Button>
      ) : null}
      {!!actions.logout.error && <QueryState error={actions.logout.error} />}
    </Screen>
  );
}
