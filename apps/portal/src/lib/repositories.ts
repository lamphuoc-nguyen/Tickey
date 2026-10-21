import { SupabaseAuthRepository, SupabaseBookingRepository, SupabaseWorkspaceRepository } from '@event/core';
import { supabase } from './supabase';

// Pages and hooks talk to the server only through these (MT §9.1, §21.1).
// One auth instance: it carries the password-recovery state from verify to reset.
export const repositories = {
  auth: new SupabaseAuthRepository(supabase),
  booking: new SupabaseBookingRepository(supabase),
  workspace: new SupabaseWorkspaceRepository(supabase),
};
