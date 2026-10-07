import { SupabaseBookingRepository, SupabaseWorkspaceRepository } from '@event/core';
import { supabase } from './supabase';

// Pages and hooks talk to the server only through these (MT §9.1, §21.1).
export const repositories = {
  booking: new SupabaseBookingRepository(supabase),
  workspace: new SupabaseWorkspaceRepository(supabase),
};
