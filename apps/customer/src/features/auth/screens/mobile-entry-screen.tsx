import { Redirect, router } from 'expo-router';
import { Button, QueryState, Screen } from '@/components/ui';
import HomeScreen from '@/features/catalog/screens/home-screen';
import { useAuth } from '../hooks/auth-context';

export default function MobileEntryScreen() {
  const auth = useAuth();
  if (auth.loading || (auth.error && !auth.session))
    return (
      <Screen back={false} navigationEnabled={false}>
        <QueryState loading={auth.loading} error={auth.error} retry={auth.retry} />
        {!auth.loading && !!auth.error && (
          <Button secondary onPress={() => router.push('/tickets/offline')}>
            Xem vé đã tải khi mất mạng
          </Button>
        )}
      </Screen>
    );
  if (auth.session?.workspace.kind === 'STAFF') return <Redirect href="/staff" />;
  if (auth.session && auth.session.workspace.kind !== 'CUSTOMER') return <Redirect href="/workspaces" />;
  return <HomeScreen />;
}
