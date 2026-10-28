import { Tabs } from 'expo-router';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, useWindowDimensions } from 'react-native';
import { customerTheme } from '@event/ui-kit';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { sessionScope } from '@/lib/session-scope';
import { TabIndicatorProvider } from './floating-navigation-context';

/** Native tab scenes retain their mounted state; reset only across account/workspace boundaries. */
export function PersistentTabLayout({ screens }: { screens: readonly { name: string; title: string }[] }) {
  const { session } = useAuth();
  const { width } = useWindowDimensions();
  // Keep motion off until the system preference has been read, including cold deep links.
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    let preferenceChanged = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      preferenceChanged = true;
      setReduceMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted && !preferenceChanged) setReduceMotion(enabled);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  const slide = useCallback<NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']>>(
    ({ current }) => ({
      sceneStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-width, 0, width],
              extrapolate: 'clamp',
            }),
          },
        ],
      },
    }),
    [width],
  );
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
          animation: reduceMotion ? 'none' : 'shift',
          transitionSpec: {
            animation: 'timing',
            config: { duration: reduceMotion ? 0 : 280, easing: Easing.out(Easing.cubic) },
          },
          sceneStyleInterpolator: slide,
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
