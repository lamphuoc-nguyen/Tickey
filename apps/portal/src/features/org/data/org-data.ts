import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';

// Org portal data from /api (database JSON, camelCase). Writes go through the RPC-backed endpoints only.

export type MemberStatus = 'INVITED' | 'ACTIVE' | 'REVOKED';

export interface Member {
  id: string;
  userId: string;
  roles: string[];
  status: MemberStatus;
  createdAt: string;
  profile: { fullName: string | null; phone: string | null } | null;
}

export interface Venue {
  id: string;
  name: string;
  timezone: string;
}

export interface OrgSession {
  id: string;
  title: string | null;
  startsAt: string;
  endsAt: string;
  doorsOpenAt: string;
  status: string;
  salesPaused: boolean;
  layoutVersionId: string;
  venue: Venue | null;
}

export interface Zone {
  id: string;
  code: string;
  name: string;
  kind: 'SEATED' | 'STANDING';
  capacity: number;
  sortOrder: number;
}

export interface GateZone {
  sessionId: string;
  gateId: string;
  zoneId: string;
}

export interface GateDevice {
  id: string;
  deviceFingerprint: string;
  name: string;
  platform: 'ANDROID' | 'IOS';
  registeredBy: string;
  status: 'ACTIVE' | 'REVOKED';
  revokeReason: string | null;
  revokedAt: string | null;
  lastSeenAt: string | null;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface OrgEvent {
  id: string;
  title: string;
  status: string;
  coverImageUrl: string | null;
  sessions: OrgSession[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  businessType: string;
  status: string;
  tier: string;
}

export interface Gate {
  id: string;
  code: string;
  name: string;
  status: string;
}

export interface StaffAssignment {
  id: string;
  sessionId: string;
  userId: string;
  gateId: string | null;
  permissions: string[];
  validFrom: string;
  validUntil: string;
  status: 'ACTIVE' | 'REVOKED';
  gate: Pick<Gate, 'id' | 'code' | 'name'> | null;
}

export const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Chủ sở hữu',
  EVENT_MANAGER: 'Quản lý sự kiện',
  FINANCE: 'Kế toán',
  GATE_MANAGER: 'Quản lý cổng',
  SCANNER: 'Soát vé',
  POS: 'Bán vé tại quầy',
};

export const PERMISSION_LABELS: Record<string, string> = {
  SCAN: 'Quét vé',
  MANUAL_CHECKIN: 'Check-in thủ công',
  POS: 'Bán vé POS',
  VIEW_ANALYTICS: 'Lưu lượng cổng',
};

/** Roles that can be assigned to gate shifts (assign_staff). */
export const STAFF_ROLES = ['SCANNER', 'POS', 'GATE_MANAGER'];

export const memberName = (member: Member | undefined) =>
  member?.profile?.fullName?.trim() || 'Thành viên chưa cập nhật tên';

export const sessionLabel = (event: Pick<OrgEvent, 'title'>, session: Pick<OrgSession, 'title'>) =>
  `${event.title} · ${session.title ?? 'Suất diễn'}`;

export function useMembers(orgId: string | null) {
  return useQuery({
    queryKey: ['org', orgId, 'members'],
    queryFn: () => api.get<Member[]>(`/api/organizations/${orgId}/members`),
    enabled: !!orgId,
  });
}

export function useOrgEvents(orgId: string | null) {
  return useQuery({
    queryKey: ['org', orgId, 'events'],
    queryFn: () => api.get<OrgEvent[]>(`/api/organizations/${orgId}/events?limit=100`),
    enabled: !!orgId,
  });
}

/** The Org of the active workspace (name, logo, status). */
export function useOrganization(orgId: string | null) {
  return useQuery({
    queryKey: ['org', orgId, 'organization'],
    queryFn: () => api.get<Organization>(`/api/organizations/${orgId}`),
    enabled: !!orgId,
  });
}

export function useVenueGates(venueId: string | null | undefined) {
  return useQuery({
    queryKey: ['venue', venueId, 'gates'],
    queryFn: async () => (await api.get<{ gates: Gate[] }>(`/api/venues/${venueId}`)).gates,
    enabled: !!venueId,
  });
}

/** Assignments of several Sessions, flattened. */
export function useStaffAssignments(sessionIds: string[]) {
  const results = useQueries({
    queries: sessionIds.map((id) => ({
      queryKey: ['session', id, 'staff-assignments'],
      queryFn: () => api.get<StaffAssignment[]>(`/api/sessions/${id}/staff-assignments`),
    })),
  });
  return {
    data: results.flatMap((result) => result.data ?? []),
    isPending: results.some((result) => result.isLoading),
    error: results.find((result) => result.error)?.error ?? null,
    refetch: () => Promise.all(results.map((result) => result.refetch())),
  };
}

/** Adds a member by email, or changes their roles. The user must already have a Tickey account. OWNER + MFA. */
export function useSetMember(orgId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; roles: string[] }) =>
      api.put(`/api/organizations/${orgId}/members`, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ['org', orgId, 'members'] }),
  });
}

export function useAssignStaff() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      ...body
    }: {
      sessionId: string;
      userId: string;
      permissions: string[];
      gateId: string | null;
      validFrom: string | null;
      validUntil: string | null;
    }) => api.post<{ id: string }>(`/api/sessions/${sessionId}/staff-assignments`, body),
    onSuccess: (_, { sessionId }) =>
      client.invalidateQueries({ queryKey: ['session', sessionId, 'staff-assignments'] }),
  });
}

export function useRevokeAssignment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (assignment: Pick<StaffAssignment, 'id' | 'sessionId'>) =>
      api.delete(`/api/staff-assignments/${assignment.id}`),
    onSuccess: (_, { sessionId }) =>
      client.invalidateQueries({ queryKey: ['session', sessionId, 'staff-assignments'] }),
  });
}

export function useOrgVenues(orgId: string | null) {
  return useQuery({
    queryKey: ['org', orgId, 'venues'],
    queryFn: () => api.get<Venue[]>(`/api/organizations/${orgId}/venues`),
    enabled: !!orgId,
  });
}

export function useSaveGate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      venueId,
      ...body
    }: {
      id?: string;
      venueId: string;
      code?: string;
      name?: string;
      status?: string;
    }) =>
      id
        ? api.put<{ id: string }>(`/api/gates/${id}`, body)
        : api.post<{ id: string }>(`/api/venues/${venueId}/gates`, body),
    onSuccess: (_, { venueId }) => client.invalidateQueries({ queryKey: ['venue', venueId, 'gates'] }),
  });
}

export function useLayoutZones(layoutVersionId: string | null | undefined) {
  return useQuery({
    queryKey: ['layout-version', layoutVersionId, 'zones'],
    queryFn: async () =>
      (await api.get<{ zones: Zone[] }>(`/api/layout-versions/${layoutVersionId}`)).zones.sort(
        (a, b) => a.sortOrder - b.sortOrder,
      ),
    enabled: !!layoutVersionId,
  });
}

export function useGateZones(sessionId: string | null | undefined) {
  return useQuery({
    queryKey: ['session', sessionId, 'gate-zones'],
    queryFn: () => api.get<GateZone[]>(`/api/sessions/${sessionId}/gate-zones`),
    enabled: !!sessionId,
  });
}

/** Replaces the whole gate → zones mapping of a Session (set_session_gate_zones). */
export function useSetGateZones() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      sessionId,
      config,
    }: {
      sessionId: string;
      config: { gateId: string; zoneIds: string[] }[];
    }) => api.put(`/api/sessions/${sessionId}/gate-zones`, { config }),
    onSuccess: (_, { sessionId }) =>
      client.invalidateQueries({ queryKey: ['session', sessionId, 'gate-zones'] }),
  });
}

export function useDevices(orgId: string | null) {
  return useQuery({
    queryKey: ['org', orgId, 'devices'],
    queryFn: () => api.get<GateDevice[]>(`/api/organizations/${orgId}/devices`),
    enabled: !!orgId,
  });
}

export function useRevokeDevice(orgId: string | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/api/devices/${id}/revoke`, { reason }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['org', orgId, 'devices'] }),
  });
}
