import { HttpPaymentApi, SupabaseBookingRepository, SupabaseWorkspaceRepository } from '@event/core';
import { supabase } from './supabase';

// Gate scanning RPCs (register_gate_device, get_session_manifest, check_in, sync_offline_scans)
// get their own repository in packages/core with S2-FE2 / S3-FE2. POS reuses booking + payment.
export const repositories = {
  booking: new SupabaseBookingRepository(supabase),
  workspace: new SupabaseWorkspaceRepository(supabase),
  payment: new HttpPaymentApi(process.env.EXPO_PUBLIC_API_URL, supabase),
};
