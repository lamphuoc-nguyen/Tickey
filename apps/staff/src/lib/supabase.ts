import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createSupabase } from '@event/core';

// EXPO_PUBLIC_* values are bundled into the app: URL and anon key only, never service_role (MT §14).
export const supabase = createSupabase({
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  storage: AsyncStorage,
  detectSessionInUrl: false,
});
