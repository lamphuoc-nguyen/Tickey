import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { Copy, Button, Heading, Notice, QueryState, Screen, ErrorNotice, Card } from '@/components/ui';
import { useMobileAccess } from '../hooks/use-mobile-access';
import { MobileAccessNotice } from '../components/mobile-access-notice';
import { automaticMobileDestination, isStaffWorkspace, mobileWorkspaceDestination } from '../mobile-workspace';

export default function WorkspaceScreen({
  staffOnly = false,
  returnPath,
}: { staffOnly?: boolean; returnPath?: string } = {}) {
  const { actions, auth, access } = useMobileAccess();
  const params = useLocalSearchParams<{ next?: string; auto?: string }>();
  const next = returnPath ?? params.next;
  const workspaces = actions.workspaces.data?.filter(isStaffWorkspace);
  if (access === 'customer') return <Redirect href={mobileWorkspaceDestination('CUSTOMER', next) as Href} />;
  if (access === 'guest') return <Redirect href="/auth/login" />;
  if (access !== 'staff') return <MobileAccessNotice />;
  if (!staffOnly && auth.session && actions.workspaces.data)
    return <Redirect href={automaticMobileDestination(actions.workspaces.data, auth.session.workspace, next) as Href} />;
  return (
    <Screen back={false} navigationEnabled={false}>
      <Heading>Chọn tổ chức làm việc</Heading>
      <Copy>Chọn tổ chức đã phân quyền nhân viên cho bạn.</Copy>
      <QueryState
        loading={auth.loading || actions.workspaces.isLoading}
        error={auth.error ?? actions.workspaces.error}
        empty={!!auth.session && actions.workspaces.isSuccess && !workspaces?.length}
        emptyText="Bạn chưa được phân quyền nhân viên tại tổ chức nào."
        retry={() => (auth.error ? auth.retry() : void actions.workspaces.refetch())}
      />
      {!auth.session && !auth.loading && (
        <Button onPress={() => router.replace('/auth/login')}>Đăng nhập</Button>
      )}
      {auth.session &&
        workspaces?.map((workspace) => (
          <Card key={`${workspace.kind}:${workspace.orgId}`}>
            <Copy>{workspace.orgName ?? 'Tổ chức chưa cung cấp tên'}</Copy>
              <Button
                busy={actions.switchWorkspace.isPending}
                disabled={
                  auth.loading ||
                  !!auth.error ||
                  !!actions.workspaces.error ||
                  (workspace.kind === 'STAFF' && !isStaffWorkspace(workspace))
                }
                disabledReason={
                  auth.loading
                    ? 'Đang xác nhận tài khoản. Vui lòng chờ.'
                    : auth.error || actions.workspaces.error
                      ? 'Chưa thể xác nhận quyền truy cập. Vui lòng thử lại.'
                      : 'Chưa thể xác nhận quyền nhân viên tại tổ chức này. Vui lòng liên hệ người quản lý.'
                }
                onPress={() =>
                  void actions.switchWorkspace
                    .mutateAsync(workspace)
                    .then(() =>
                      router.replace(
                        mobileWorkspaceDestination(workspace.kind as 'CUSTOMER' | 'STAFF', next) as Href,
                      ),
                    )
                    .catch(() => {})
                }
              >
                Vào tổ chức làm việc
              </Button>
          </Card>
        ))}
      {!!actions.switchWorkspace.error && <ErrorNotice error={actions.switchWorkspace.error} />}
      <Notice>Vai trò nhân viên do tổ chức cấp. Bạn chỉ có thể chọn trong các tổ chức được phân quyền.</Notice>
      <Button secondary busy={actions.logout.isPending}
        onPress={() => void actions.logout.mutateAsync().then(() => router.replace('/auth/login')).catch(() => {})}>
        Đăng xuất
      </Button>
      {!!actions.logout.error && <ErrorNotice error={actions.logout.error} />}
    </Screen>
  );
}
