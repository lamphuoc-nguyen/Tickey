import { describe, expect, it } from 'vitest';
import { currentStaffShifts, staffAssignmentSchema, staffShiftPhase } from './staff';

const assignment = (id: string, validFrom: string, validUntil: string, tenant = 't') =>
  staffAssignmentSchema.parse({
    id,
    tenant_id: tenant,
    session_id: 's',
    gate_id: null,
    permissions: ['SCAN'],
    valid_from: validFrom,
    valid_until: validUntil,
    status: 'ACTIVE',
    gate: null,
    session: null,
  });
const now = Date.parse('2026-10-24T12:00:00Z');

describe('staff shifts', () => {
  it('derives the phase from the assignment window', () => {
    expect(staffShiftPhase(assignment('a', '2026-10-24T11:00:00Z', '2026-10-24T13:00:00Z'), now)).toBe('ACTIVE');
    expect(staffShiftPhase(assignment('u', '2026-10-24T13:00:00Z', '2026-10-24T15:00:00Z'), now)).toBe('UPCOMING');
    expect(staffShiftPhase(assignment('e', '2026-10-24T09:00:00Z', '2026-10-24T12:00:00Z'), now)).toBe('ENDED');
  });
  it('drops ended shifts and puts the current one first', () => {
    const shifts = currentStaffShifts(
      [
        assignment('later', '2026-10-25T11:00:00Z', '2026-10-25T13:00:00Z'),
        assignment('ended', '2026-10-23T11:00:00Z', '2026-10-23T13:00:00Z'),
        assignment('soon', '2026-10-24T13:00:00Z', '2026-10-24T15:00:00Z'),
        assignment('now', '2026-10-24T08:00:00Z', '2026-10-24T20:00:00Z'),
      ],
      't',
      now,
    );
    expect(shifts.map((shift) => shift.id)).toEqual(['now', 'soon', 'later']);
  });
  it('only keeps the active organization and tolerates unknown permissions', () => {
    const other = assignment('other', '2026-10-24T08:00:00Z', '2026-10-24T20:00:00Z', 'other-org');
    const mine = staffAssignmentSchema.parse({
      ...{ id: 'mine', tenant_id: 't', session_id: 's', gate_id: null, status: 'ACTIVE', gate: null, session: null },
      permissions: ['SCAN', 'FUTURE_PERMISSION'],
      valid_from: '2026-10-24T08:00:00Z',
      valid_until: '2026-10-24T20:00:00Z',
    });
    expect(currentStaffShifts([other, mine], 't', now).map((shift) => shift.id)).toEqual(['mine']);
    expect(currentStaffShifts([other, mine], undefined, now)).toEqual([]);
  });
});
