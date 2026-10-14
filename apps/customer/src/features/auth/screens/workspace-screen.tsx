import { Redirect, router, useLocalSearchParams, type Href } from 'expo-router';
import { Copy, Button, Heading, Notice, QueryState, Screen, ErrorNotice, Card } from '@/components/ui';
import { useAuthActions } from '../hooks/use-auth-actions';
import { useAuth } from '../hooks/auth-context';
import {
  automaticMobileDestination,
  isStaffWorkspace,
  mobileWorkspaceDestination,
} from '../mobile-workspace';

export default function WorkspaceScreen() {
  const actions = useAuthActions();
  const auth = useAuth();
  const { next, auto } = useLocalSearchParams<{ next?: string; auto?: string }>();
  const destination =
    auto === '1' && auth.session && !auth.error && actions.workspaces.data && !actions.workspaces.error
      ? automaticMobileDestination(actions.workspaces.data, auth.session.workspace, next)
      : null;
  if (!auth.loading && destination) return <Redirect href={destination as Href} />;
  return (
    <Screen>
      <Heading>Chọn vai trò sử dụng</Heading>
      <Copy>Mua vé hoặc làm việc với tổ chức đã phân quyền cho bạn trong cùng ứng dụng Tickey.</Copy>
      <QueryState
        loading={auth.loading || actions.workspaces.isLoading}
        error={auth.error ?? actions.workspaces.error}
        empty={!!auth.session && actions.workspaces.isSuccess && !actions.workspaces.data?.length}
        emptyText="Tài khoản chưa có vai trò sử dụng."
        retry={() => (auth.error ? auth.retry() : void actions.workspaces.refetch())}
      />
      {!auth.session && !auth.loading && (
        <Button onPress={() => router.replace('/auth/login')}>Đăng nhập</Button>
      )}
      {auth.session &&
        actions.workspaces.data?.map((workspace) => (
          <Card key={`${workspace.kind}:${workspace.orgId}`}>
            <Copy>
              {workspace.kind === 'CUSTOMER'
                ? 'Khách hàng · Khám phá và đặt vé'
                : workspace.kind === 'STAFF'
                  ? `Nhân viên · ${workspace.orgName ?? 'Tổ chức chưa cung cấp tên'}`
                  : `${workspace.kind} · ${workspace.orgName ?? 'Nền tảng'}`}
            </Copy>
            {workspace.kind === 'CUSTOMER' || workspace.kind === 'STAFF' ? (
              <Button
                busy={actions.switchWorkspace.isPending}
                disabled={workspace.kind === 'STAFF' && !isStaffWorkspace(workspace)}
                disabledReason="Chưa thể xác nhận quyền nhân viên tại tổ chức này. Vui lòng liên hệ người quản lý."
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
                {workspace.kind === 'CUSTOMER' ? 'Khám phá và đặt vé' : 'Vào khu vực nhân viên'}
              </Button>
            ) : (
              <>
                <Notice>Sử dụng Portal để làm việc trong không gian này.</Notice>
                <Button secondary onPress={() => router.push('/auth/access-info')}>
                  Thông tin truy cập
                </Button>
              </>
            )}
          </Card>
        ))}
      {!!actions.switchWorkspace.error && <ErrorNotice error={actions.switchWorkspace.error} />}
    </Screen>
  );
}
