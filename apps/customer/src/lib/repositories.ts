import { HttpPaymentApi, SupabaseBookingRepository, SupabaseWorkspaceRepository } from '@event/core';
import { supabase } from './supabase';

// Screens and hooks talk to the server only through these (MT §9.1, §21.1).
export const repositories = {
  booking: new SupabaseBookingRepository(supabase),
  workspace: new SupabaseWorkspaceRepository(supabase),
  payment: new HttpPaymentApi(process.env.EXPO_PUBLIC_API_URL, supabase),
};
