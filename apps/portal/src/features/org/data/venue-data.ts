import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LayoutData } from '@event/seat-map';
import { api } from '../../../lib/api';
import type { Gate, Zone } from './org-data';

export const VENUE_TYPES: Record<string, string> = {
  THEATER: 'Nhà hát',
  STADIUM: 'Sân vận động',
  HALL: 'Hội trường',
  OUTDOOR: 'Ngoài trời',
  CLUB: 'Club / phòng trà',
  OTHER: 'Khác',
};

export interface VenueDetail {
  id: string;
  tenantId: string;
  name: string;
  venueType: string;
  addressLine: string;
  ward: string | null;
  district: string | null;
  city: string;
  timezone: string;
  capacity: number;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  gates?: Gate[];
  layouts?: {
    id: string;
    name: string;
    createdAt: string;
    versions: LayoutVersionSummary[];
  }[];
}

export interface LayoutVersionSummary {
  id: string;
  versionNo: number;
  status: 'DRAFT' | 'PUBLISHED';
  totalCapacity: number | null;
  publishedAt: string | null;
}

export interface LayoutVersion extends LayoutVersionSummary {
  layoutId: string;
  venueId: string;
  // The definition is stored as the editor wrote it; its keys are not database columns.
  definition: LayoutData | null;
  zones: Zone[];
}

export type VenueInput = Pick<
  VenueDetail,
  | 'name'
  | 'venueType'
  | 'addressLine'
  | 'ward'
  | 'district'
  | 'city'
  | 'timezone'
  | 'capacity'
  | 'description'
>;

export function useVenue(venueId: string | null | undefined) {
  return useQuery({
    queryKey: ['venue', venueId],
    queryFn: () => api.get<VenueDetail>(`/api/venues/${venueId}`),
    enabled: !!venueId,
  });
}

export function useOrgVenueList(orgId: string | null) {
  return useQuery({
    queryKey: ['org', orgId, 'venues'],
    queryFn: () => api.get<VenueDetail[]>(`/api/organizations/${orgId}/venues`),
    enabled: !!orgId,
  });
}

export function useSaveVenue(orgId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<VenueInput> & { id?: string; status?: string }) =>
      id
        ? api.put<{ id: string }>(`/api/venues/${id}`, body)
        : api.post<{ id: string }>('/api/venues', { ...body, tenantId: orgId }),
    onSuccess: ({ id }) => {
      void client.invalidateQueries({ queryKey: ['org', orgId, 'venues'] });
      void client.invalidateQueries({ queryKey: ['venue', id] });
    },
  });
}

export function useLayoutVersion(id: string | null | undefined) {
  return useQuery({
    queryKey: ['layout-version', id],
    queryFn: () => api.get<LayoutVersion>(`/api/layout-versions/${id}`),
    enabled: !!id,
  });
}

export function useCreateLayout(venueId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<{ layoutId: string; layoutVersionId: string }>(`/api/venues/${venueId}/layouts`, { name }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['venue', venueId] }),
  });
}

/** Draft of a published layout: reuses an existing draft, otherwise copies the last version. */
export function useNewLayoutVersion(venueId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (layoutId: string) => api.post<{ id: string }>(`/api/layouts/${layoutId}/versions`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['venue', venueId] }),
  });
}

export function useSaveLayoutDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, definition }: { id: string; definition: LayoutData }) =>
      api.put(`/api/layout-versions/${id}/draft`, { definition }),
    onSuccess: (_, { id }) => client.invalidateQueries({ queryKey: ['layout-version', id] }),
  });
}

export function usePublishLayout(venueId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ layoutVersionId: string; totalCapacity: number }>(`/api/layout-versions/${id}/publish`),
    onSuccess: (_, id) => {
      void client.invalidateQueries({ queryKey: ['layout-version', id] });
      void client.invalidateQueries({ queryKey: ['venue', venueId] });
    },
  });
}
