// Staff uses the same singleton client and session as Customer. Never create a second auth client.
export { getSupabase } from '@/lib/supabase';
