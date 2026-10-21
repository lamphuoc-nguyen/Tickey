import { currentStaffShifts } from '@event/core';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { repositories } from '@/lib/repositories';
import { sessionScope } from '@/lib/session-scope';

const PHASE_TICK_MS = 30_000;

/** The active organization's current and upcoming shifts; re-evaluated as shifts start and end. */
export function useStaffShifts() {
  const { session } = useAuth();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), PHASE_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ['staff-assignments', ...sessionScope(session)],
    queryFn: ({ signal }) => repositories.staff.assignments(signal),
    enabled: !!session && session.workspace.kind === 'STAFF',
    refetchOnReconnect: true,
  });
  // The endpoint returns assignments from every organization; only the active workspace's are shown.
  const shifts = currentStaffShifts(query.data ?? [], session?.workspace.orgId, now);
  return { query, shifts, now };
}
