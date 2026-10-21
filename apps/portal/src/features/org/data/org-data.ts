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
  venue: Venue | null;
}

export interface OrgEvent {
  id: string;
  title: string;
  status: string;
  coverImageUrl: string | null;
  sessions: OrgSession[];
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
    isPending: results.some((result) => result.isPending),
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
