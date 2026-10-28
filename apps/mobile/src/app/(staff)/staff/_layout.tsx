import { Stack } from 'expo-router';
export const unstable_settings = { initialRouteName: '(tabs)' };
export default function StaffStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
