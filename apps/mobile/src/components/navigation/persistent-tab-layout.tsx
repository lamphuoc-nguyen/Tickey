import { Tabs } from 'expo-router';
import { customerTheme } from '@event/ui-kit';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { sessionScope } from '@/lib/session-scope';
import { TabIndicatorProvider } from './floating-navigation-context';

/** Native tab scenes retain their mounted state; reset only across account/workspace boundaries. */
export function PersistentTabLayout({ screens }: { screens: readonly { name: string; title: string }[] }) {
  const { session } = useAuth();
  return (
    <TabIndicatorProvider key={sessionScope(session).join(':')}>
      <Tabs
        initialRouteName="index"
        tabBar={() => null}
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          lazy: true,
          freezeOnBlur: true,
          animation: 'none',
          sceneStyle: { backgroundColor: customerTheme.colors.background },
        }}
      >
        {screens.map((screen) => (
          <Tabs.Screen key={screen.name} name={screen.name} options={{ title: screen.title }} />
        ))}
      </Tabs>
    </TabIndicatorProvider>
  );
}
