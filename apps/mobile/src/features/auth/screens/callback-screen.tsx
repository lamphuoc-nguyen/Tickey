import { router, useLocalSearchParams } from 'expo-router';
import { Button, QueryState, Screen } from '@/components/ui';
import { useAuthCallback } from '../hooks/use-auth-callback';
import type { AuthCallbackRouteParams } from '../auth-callback';

export default function CallbackScreen() {
  const params = useLocalSearchParams<AuthCallbackRouteParams>();
  const error = useAuthCallback(params);
  return (
    <Screen>
      <QueryState loading={!error} error={error} />
      {!!error && (
        <>
          <Button
            onPress={() => router.replace(params.type === 'recovery' ? '/auth/forgot' : '/auth/verify')}
          >
            Yêu cầu liên kết mới
          </Button>
          <Button secondary onPress={() => router.replace('/auth/login')}>
            Về đăng nhập
          </Button>
        </>
      )}
    </Screen>
  );
}
