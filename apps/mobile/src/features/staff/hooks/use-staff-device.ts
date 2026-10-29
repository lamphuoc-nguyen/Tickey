import { useQuery } from '@tanstack/react-query';
import { registerStaffDevice } from '../lib/staff-api';

export function useStaffDevice(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ['staff-device', orgId],
    queryFn: () => registerStaffDevice(orgId!),
    enabled: !!orgId,
    staleTime: Infinity,
    retry: 1,
  });
}
