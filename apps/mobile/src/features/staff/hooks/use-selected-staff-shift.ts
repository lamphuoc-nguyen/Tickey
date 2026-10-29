import { useLocalSearchParams } from 'expo-router';
import { useStaffShifts } from './use-staff-shifts';

export function useSelectedStaffShift() {
  const params = useLocalSearchParams<{ sessionId?: string; assignmentId?: string }>();
  const result = useStaffShifts();
  const selected =
    result.shifts.find((shift) => shift.id === params.assignmentId) ??
    result.shifts.find((shift) => shift.sessionId === params.sessionId) ??
    result.shifts[0];
  return { ...result, params, selected };
}
