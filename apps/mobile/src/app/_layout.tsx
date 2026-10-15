import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '@/features/auth/hooks/auth-context';
import { configurationError } from '@/lib/configuration';
import { Copy, Heading, QueryState, Screen } from '@/components/ui';
import { NotificationNavigator } from '@/features/customer/notifications/components/notification-navigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, networkMode: 'always' },
    mutations: { retry: false, networkMode: 'always' },
  },
});

// With grouped routes, native startup must not select the first alphabetical (auth) group.
export const unstable_settings = { initialRouteName: '(customer)' };

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    BeVietnamPro: require('../../assets/fonts/BeVietnamPro-Regular.ttf'),
    'BeVietnamPro-Medium': require('../../assets/fonts/BeVietnamPro-Medium.ttf'),
    'BeVietnamPro-SemiBold': require('../../assets/fonts/BeVietnamPro-SemiBold.ttf'),
    'BeVietnamPro-Bold': require('../../assets/fonts/BeVietnamPro-Bold.ttf'),
    'Outfit-Bold': require('../../assets/fonts/Outfit-Bold.ttf'),
    'Lora-Bold': require('../../assets/fonts/Lora-Bold.ttf'),
  });
  const error = configurationError();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {!fontsLoaded ? (
          <Screen back={false} navigationEnabled={false}>
            <QueryState loading={!fontError} error={fontError} />
          </Screen>
        ) : error ? (
          <Screen back={false} navigationEnabled={false}>
            <Heading>Thiếu cấu hình ứng dụng</Heading>
            <Copy>{error}</Copy>
          </Screen>
        ) : (
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <NotificationNavigator />
              <Stack
                initialRouteName="(customer)"
                screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FFFAF8' } }}
              />
            </AuthProvider>
          </QueryClientProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
