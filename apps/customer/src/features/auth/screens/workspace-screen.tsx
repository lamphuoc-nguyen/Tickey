import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Copy, Button, Heading, Notice, QueryState, Screen, ErrorNotice, Card } from '@/components/ui';
import { useAuthActions } from '../hooks/use-auth-actions';
import { useAuth } from '../hooks/auth-context';
import { safeReturnPath } from '../safe-return-path';

export default function WorkspaceScreen() {
  const actions = useAuthActions();
  const auth = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  return (
    <Screen>
      <Heading>Không gian làm việc</Heading>
      <QueryState
        loading={auth.loading || actions.workspaces.isLoading}
        error={actions.workspaces.error}
        retry={() => void actions.workspaces.refetch()}
      />
      {!auth.session && !auth.loading && (
        <Button onPress={() => router.replace('/auth/login')}>Đăng nhập</Button>
      )}
      {actions.workspaces.data?.map((workspace) => (
        <Card key={`${workspace.kind}:${workspace.orgId}`}>
          <Copy>
            {workspace.kind === 'CUSTOMER'
              ? 'Customer · Khám phá và đặt vé'
              : `${workspace.kind} · ${workspace.orgName ?? 'Nền tảng'}`}
          </Copy>
          {workspace.kind === 'CUSTOMER' ? (
            <Button
              busy={actions.switchWorkspace.isPending}
              onPress={() =>
                void actions.switchWorkspace
                  .mutateAsync()
                  .then(() => router.replace(safeReturnPath(next) as Href))
                  .catch(() => {})
              }
            >
              Vào Customer
            </Button>
          ) : (
            <>
              <Notice>
                {workspace.kind === 'STAFF'
                  ? 'Sử dụng ứng dụng Staff cho ca làm của bạn.'
                  : 'Sử dụng Portal để làm việc trong không gian này.'}
              </Notice>
              {workspace.kind !== 'STAFF' && (
                <Button secondary onPress={() => router.push('/auth/access-info')}>
                  Thông tin truy cập
                </Button>
              )}
            </>
          )}
        </Card>
      ))}
      {!!actions.switchWorkspace.error && <ErrorNotice error={actions.switchWorkspace.error} />}
    </Screen>
  );
}
