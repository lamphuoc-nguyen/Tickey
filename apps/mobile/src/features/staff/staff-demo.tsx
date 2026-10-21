import type { ComponentType } from 'react';
import { Redirect } from 'expo-router';

// Local-only visual preview. It is opt-in and ignored outside development builds.
export const staffDemo = __DEV__ && process.env.EXPO_PUBLIC_STAFF_DEMO === 'true';

// Screens that still render hardcoded data stay unreachable unless the preview is on.
export function staffDemoOnly(Screen: ComponentType) {
  return function StaffDemoRoute() {
    return staffDemo ? <Screen /> : <Redirect href="/staff" />;
  };
}
