import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';
import { StaffGate } from '@/features/staff/components/staff-gate';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <StaffGate>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }} />
      </ThemeProvider>
    </StaffGate>
  );
}
