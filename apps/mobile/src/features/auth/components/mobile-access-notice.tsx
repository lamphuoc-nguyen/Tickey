import { router } from 'expo-router';
import { Button, Copy, ErrorNotice, Heading, QueryState, Screen } from '@/components/ui';
import { useMobileAccess } from '../hooks/use-mobile-access';
import { useConnection } from '@/features/customer/tickets/hooks/use-ticket';
import { canReadOfflineSnapshots } from '@/features/customer/tickets/offline-access';

/** Server routes stay blocked while role is unresolved; offline snapshots are read-only. */
export function MobileAccessNotice() {
  const { auth, actions, access } = useMobileAccess();
  const online = useConnection();
  const offlineSnapshots = canReadOfflineSnapshots({
    pathname: '/tickets/offline',
    online,
    session: auth.session,
    loading: auth.loading,
    authError: auth.error,
    membershipError: actions.workspaces.error,
    workspaces: actions.workspaces.data,
  });
  return (
    <Screen back={false} navigationEnabled={false}>
      <Heading>{access === 'revoked' ? 'Quyền truy cập đã thay đổi' : 'Kiểm tra quyền truy cập'}</Heading>
      {access === 'loading' || access === 'error' ? (
        <QueryState
          loading={access === 'loading'}
          error={auth.error ?? actions.workspaces.error}
          retry={() => (auth.error ? auth.retry() : void actions.workspaces.refetch())}
        />
      ) : (
        <>
          <Copy>
            Chưa thể xác nhận quyền sử dụng của tài khoản. Liên hệ người quản lý để kiểm tra quyền truy cập.
          </Copy>
          <Button secondary onPress={() => void actions.workspaces.refetch()}>
            Kiểm tra lại
          </Button>
        </>
      )}
      {offlineSnapshots && (
        <Button secondary onPress={() => router.push('/tickets/offline')}>
          Xem vé đã tải khi mất mạng
        </Button>
      )}
      {auth.session && (
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
      )}
      {!!actions.logout.error && <ErrorNotice error={actions.logout.error} />}
    </Screen>
  );
}
