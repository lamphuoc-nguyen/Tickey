import { createSupabase } from '@event/core';

// VITE_* values are bundled into the page: URL and anon key only, never service_role (MT §14).
export const supabase = createSupabase({
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});
