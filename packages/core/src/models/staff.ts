import { z } from 'zod';
import { mapDatabaseJson } from './database-mapper';

const nullable = z.string().nullable();

/** GET /api/me/staff-assignments: the caller's ACTIVE assignments with gate and session embeds. */
export const staffAssignmentSchema = z
  .object({
    id: z.string(),
    tenant_id: z.string(),
    session_id: z.string(),
    gate_id: nullable,
    // Plain strings: a permission added later on the server must not reject the whole list.
    permissions: z.array(z.string()),
    valid_from: z.string(),
    valid_until: z.string(),
    status: z.string(),
    gate: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
    session: z
      .object({
        id: z.string(),
        title: nullable,
        starts_at: z.string(),
        ends_at: nullable,
        doors_open_at: nullable,
        status: z.string(),
        event: z.object({ id: z.string(), title: z.string(), cover_image_url: nullable }).nullable(),
      })
      .nullable(),
  })
  .transform(mapDatabaseJson);
export type StaffAssignment = z.infer<typeof staffAssignmentSchema>;
export type StaffShiftPhase = 'ACTIVE' | 'UPCOMING' | 'ENDED';

export function staffShiftPhase(assignment: StaffAssignment, now = Date.now()): StaffShiftPhase {
  if (now < Date.parse(assignment.validFrom)) return 'UPCOMING';
  if (now >= Date.parse(assignment.validUntil)) return 'ENDED';
  return 'ACTIVE';
}

/** The active organization's shifts still worth showing: current first, then by start time. */
export function currentStaffShifts(
  assignments: StaffAssignment[],
  orgId: string | null | undefined,
  now = Date.now(),
): StaffAssignment[] {
  const rank = { ACTIVE: 0, UPCOMING: 1, ENDED: 2 } as const;
  return assignments
    .filter((assignment) => assignment.tenantId === orgId)
    .map((assignment) => ({ assignment, phase: staffShiftPhase(assignment, now) }))
    .filter(({ phase }) => phase !== 'ENDED')
    .sort(
      (a, b) =>
        rank[a.phase] - rank[b.phase] ||
        Date.parse(a.assignment.validFrom) - Date.parse(b.assignment.validFrom),
    )
    .map(({ assignment }) => assignment);
}
