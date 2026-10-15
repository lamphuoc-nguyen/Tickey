import { useEffect, useRef } from 'react';
import { Redirect, Stack, useSegments, usePathname } from 'expo-router';
import { Button, ErrorNotice, Heading, QueryState, Screen } from '@/components/ui';
import { useMobileAccess } from '@/features/auth/hooks/use-mobile-access';
import { MobileAccessNotice } from '@/features/auth/components/mobile-access-notice';
import { needsCustomerWorkspace } from '../customer-mode';

/** Staff membership overrides CUSTOMER; a URL or prototype button cannot switch the account role. */
export default function CustomerModeLayout() {
  const { auth, actions, access } = useMobileAccess();
  const customer = actions.workspaces.data?.find((workspace) => workspace.kind === 'CUSTOMER');
  const attempted = useRef<string | null>(null);
  const activate = actions.switchWorkspace.mutateAsync;
  const busy = actions.switchWorkspace.isPending;
  const session = auth.session;
  const segments = useSegments();
  const pathname = usePathname();
  const active = segments[0] === '(customer)';
  const needsSwitch = access === 'customer' && needsCustomerWorkspace(session, segments[0], pathname);
  const membershipError = actions.workspaces.error;
  useEffect(() => {
    if (!needsSwitch) {
      attempted.current = null;
      return;
    }
    if (!session || !customer || busy || membershipError) return;
    const identity = `${session.userId}:${session.workspace.kind}:${session.workspace.orgId}`;
    if (attempted.current === identity) return;
    attempted.current = identity;
    void activate(customer).catch(() => {});
  }, [needsSwitch, customer, busy, activate, session, membershipError]);
  if (active && (access === 'staff' || access === 'revoked')) return <Redirect href="/staff" />;
  if (active && access !== 'customer' && access !== 'guest') return <MobileAccessNotice />;
  if (!needsSwitch) return <Stack screenOptions={{ headerShown: false }} />;
  return (
    <Screen back={false} navigationEnabled={false}>
      <Heading>Chuẩn bị tài khoản</Heading>
      <QueryState
        loading={actions.workspaces.isPending || busy}
        error={actions.workspaces.error}
        retry={() => void actions.workspaces.refetch()}
        empty={actions.workspaces.isSuccess && !customer}
        emptyText="Chưa thể xác nhận quyền truy cập của tài khoản."
      />
      {!!actions.switchWorkspace.error && <ErrorNotice error={actions.switchWorkspace.error} />}
      {customer && !busy && !membershipError && (
        <Button onPress={() => void activate(customer).catch(() => {})}>Thử lại</Button>
      )}
    </Screen>
  );
}
