import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { OrgSession } from './org-data';

export const EVENT_STATUS: Record<string, { label: string; badge: string }> = {
  DRAFT: { label: 'Bản nháp', badge: 'badge-warning' },
  PENDING_REVIEW: { label: 'Chờ duyệt', badge: 'badge-info' },
  CHANGES_REQUESTED: { label: 'Cần chỉnh sửa', badge: 'badge-warning' },
  REJECTED: { label: 'Bị từ chối', badge: 'badge-danger' },
  PUBLISHED: { label: 'Đã công bố', badge: 'badge-success' },
  CANCELLED: { label: 'Đã hủy', badge: 'badge-danger' },
  ENDED: { label: 'Đã kết thúc', badge: 'badge-info' },
};

export const SESSION_STATUS: Record<string, string> = {
  SCHEDULED: 'Chưa mở bán',
  ON_SALE: 'Đang bán',
  SALES_CLOSED: 'Ngừng bán',
  ONGOING: 'Đang diễn ra',
  ENDED: 'Đã kết thúc',
  POSTPONED: 'Hoãn',
  CANCELLED: 'Đã hủy',
};

export const TICKET_KIND: Record<string, string> = {
  PAID: 'Có phí',
  FREE: 'Miễn phí (0đ)',
  COMP: 'Vé mời (COMP)',
};

export interface OrgEventDetail {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  summary: string | null;
  description: string | null;
  categoryId: string | null;
  coverImageUrl: string | null;
  ageLimit: number | null;
  terms: string | null;
  status: string;
  createdAt: string;
  sessions: (OrgSession & {
    salesStartAt: string;
    salesEndAt: string;
    maxTicketsPerAccount: number;
    salesPausedReason: string | null;
  })[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
}

export interface TicketTypeManage {
  id: string;
  sessionId: string;
  name: string;
  description: string | null;
  kind: 'PAID' | 'FREE' | 'COMP';
  priceAmount: number;
  maxPerOrder: number | null;
  saleStartAt: string | null;
  saleEndAt: string | null;
  refundPolicy: 'ONLY_IF_CANCELLED' | 'REFUNDABLE_BEFORE_DEADLINE';
  refundDeadlineHours: number | null;
  visibility: 'PUBLIC' | 'HIDDEN';
  status: 'ACTIVE' | 'INACTIVE';
  sortOrder: number;
  zones: { zoneId: string }[];
  inventory:
    | { quota: number; locked: number; sold: number }
    | { quota: number; locked: number; sold: number }[]
    | null;
}

export interface SessionSeat {
  seatId: string;
  zoneId: string;
  ticketTypeId: string | null;
  status: 'AVAILABLE' | 'LOCKED' | 'SOLD' | 'BLOCKED' | 'HELD';
  holdReason: string | null;
  seat: { seatCode: string; rowLabel: string; seatNumber: string; x: number; y: number };
}

export const inventoryOf = (ticketType: TicketTypeManage) =>
  (Array.isArray(ticketType.inventory) ? ticketType.inventory[0] : ticketType.inventory) ?? {
    quota: 0,
    locked: 0,
    sold: 0,
  };

/** "Đêm nhạc Mùa Thu" → "dem-nhac-mua-thu" (events.slug: ^[a-z0-9-]{3,120}$). */
export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<Category[]>('/api/categories'),
    staleTime: 3600_000,
  });
}

/** The Org's events with their sessions (same query key as useOrgEvents). */
export function useOrgEventDetails(orgId: string | null) {
  return useQuery({
    queryKey: ['org', orgId, 'events'],
    queryFn: () => api.get<OrgEventDetail[]>(`/api/organizations/${orgId}/events?limit=100`),
    enabled: !!orgId,
  });
}

function useOrgEventsMutation<TInput, TResult>(
  orgId: string | null,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: ['org', orgId, 'events'] }),
  });
}

export const useSaveEvent = (orgId: string | null) =>
  useOrgEventsMutation(orgId, ({ id, ...body }: Record<string, unknown> & { id?: string }) =>
    id
      ? api.put<{ id: string }>(`/api/events/${id}`, body)
      : api.post<{ id: string }>('/api/events', { ...body, tenantId: orgId }),
  );

export const useSubmitEvent = (orgId: string | null) =>
  useOrgEventsMutation(orgId, (eventId: string) => api.post(`/api/events/${eventId}/submit`));

export const useCancelEvent = (orgId: string | null) =>
  useOrgEventsMutation(orgId, ({ eventId, reason }: { eventId: string; reason: string }) =>
    api.post(`/api/events/${eventId}/cancellation`, { reason }),
  );

export const useSaveSession = (orgId: string | null) =>
  useOrgEventsMutation(orgId, ({ id, ...body }: Record<string, unknown> & { id?: string }) =>
    id
      ? api.put<{ id: string }>(`/api/sessions/${id}`, body)
      : api.post<{ id: string }>('/api/sessions', body),
  );

export const useCancelSession = (orgId: string | null) =>
  useOrgEventsMutation(orgId, ({ sessionId, reason }: { sessionId: string; reason: string }) =>
    api.post(`/api/sessions/${sessionId}/cancellation`, { reason }),
  );

export function useTicketTypes(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: ['session', sessionId, 'ticket-types'],
    queryFn: () => api.get<TicketTypeManage[]>(`/api/sessions/${sessionId}/ticket-types/manage`),
    enabled: !!sessionId,
  });
}

export function useSaveTicketType(sessionId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Record<string, unknown> & { id?: string }) =>
      id
        ? api.put<{ id: string }>(`/api/ticket-types/${id}`, body)
        : api.post<{ id: string }>('/api/ticket-types', { ...body, sessionId }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['session', sessionId, 'ticket-types'] }),
  });
}

export function useSessionSeats(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: ['session', sessionId, 'seats'],
    queryFn: () => api.get<SessionSeat[]>(`/api/sessions/${sessionId}/seats`),
    enabled: !!sessionId,
  });
}

function useSeatsMutation<TInput, TResult>(
  sessionId: string | null | undefined,
  mutationFn: (input: TInput) => Promise<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['session', sessionId, 'seats'] });
      void client.invalidateQueries({ queryKey: ['session', sessionId, 'ticket-types'] });
    },
  });
}

export const useAssignSeats = (sessionId: string | null | undefined) =>
  useSeatsMutation(sessionId, ({ seatIds, ticketTypeId }: { seatIds: string[]; ticketTypeId: string }) =>
    api.put<{ updated: number; requested: number }>(`/api/sessions/${sessionId}/seats/ticket-type`, {
      seatIds,
      ticketTypeId,
    }),
  );

export const useSetSeatStatus = (sessionId: string | null | undefined) =>
  useSeatsMutation(
    sessionId,
    ({
      seatIds,
      action,
      reason,
    }: {
      seatIds: string[];
      action: 'HOLD' | 'BLOCK' | 'RELEASE';
      reason?: string;
    }) => api.put(`/api/sessions/${sessionId}/seats/status`, { seatIds, action, reason }),
  );

export interface ZoneInventory {
  zoneId: string;
  capacity: number;
  locked: number;
  sold: number;
  held: number;
}

export function useZoneInventory(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: ['session', sessionId, 'zone-inventory'],
    queryFn: () => api.get<ZoneInventory[]>(`/api/sessions/${sessionId}/zone-inventory`),
    enabled: !!sessionId,
  });
}

export function useSetZoneHeld(sessionId: string | null | undefined) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ zoneId, held }: { zoneId: string; held: number }) =>
      api.put(`/api/sessions/${sessionId}/zones/${zoneId}/held`, { held }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['session', sessionId, 'zone-inventory'] }),
  });
}
