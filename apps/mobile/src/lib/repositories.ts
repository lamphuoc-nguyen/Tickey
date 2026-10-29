import {
  HttpCatalogRepository,
  HttpClient,
  HttpCustomerRepository,
  HttpPaymentApi,
  HttpStaffRepository,
  SupabaseAuthRepository,
  SupabaseBookingRepository,
  SupabasePreferencesRepository,
  SupabaseWorkspaceRepository,
} from '@event/core';
import { getSupabase } from './supabase';
import { apiRequestTimeout } from './api-timeout';

// Screens and hooks talk to the server only through these (MT §9.1, §21.1).
function createRepositories() {
  const client = getSupabase();
  const http = new HttpClient(
    process.env.EXPO_PUBLIC_API_URL,
    client,
    apiRequestTimeout(process.env.EXPO_PUBLIC_API_URL),
  );
  return {
    http,
    catalog: new HttpCatalogRepository(http),
    customer: new HttpCustomerRepository(http),
    staff: new HttpStaffRepository(http),
    preferences: new SupabasePreferencesRepository(client),
    auth: new SupabaseAuthRepository(client),
    booking: new SupabaseBookingRepository(client),
    workspace: new SupabaseWorkspaceRepository(client),
    payment: new HttpPaymentApi(process.env.EXPO_PUBLIC_API_URL, client),
  };
}
let instance: ReturnType<typeof createRepositories> | undefined;
export function getRepositories() {
  return (instance ??= createRepositories());
}
export const repositories = {
  get http() {
    return getRepositories().http;
  },
  get catalog() {
    return getRepositories().catalog;
  },
  get customer() {
    return getRepositories().customer;
  },
  get staff() {
    return getRepositories().staff;
  },
  get preferences() {
    return getRepositories().preferences;
  },
  get auth() {
    return getRepositories().auth;
  },
  get booking() {
    return getRepositories().booking;
  },
  get workspace() {
    return getRepositories().workspace;
  },
  get payment() {
    return getRepositories().payment;
  },
};
