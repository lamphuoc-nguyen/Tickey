import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';

export type { SupabaseClient };

export interface SupabaseConfig {
  url: string | undefined;
  anonKey: string | undefined;
  /** AsyncStorage on React Native; omit on the web (localStorage). */
  storage?: SupportedStorage;
  /** false on React Native (no URL-based OAuth callback). */
  detectSessionInUrl?: boolean;
}

/**
 * The only place that creates a Supabase client (MT §9.1). Fails loudly on missing config
 * instead of running half-initialised (MT §18 step 4).
 */
export function createSupabase({
  url,
  anonKey,
  storage,
  detectSessionInUrl = true,
}: SupabaseConfig): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      'Missing Supabase URL / anon key: copy .env.example to .env.local and fill it from `supabase status`.',
    );
  }
  return createClient(url, anonKey, {
    auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl },
  });
}
