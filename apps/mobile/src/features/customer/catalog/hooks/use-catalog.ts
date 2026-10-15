import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { repositories } from '@/lib/repositories';
export function useCategories() {
  return useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: ({ signal }) => repositories.catalog.categories(signal),
    staleTime: 300000,
  });
}
export function useEvents(input: { q?: string; categoryId?: string; featured?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ['catalog', 'events', input],
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      repositories.catalog.events({ ...input, limit: 20, offset: pageParam }, signal),
    getNextPageParam: (last, all) => (last.length === 20 ? all.length * 20 : undefined),
  });
}
export function useEvent(id: string) {
  return useQuery({
    queryKey: ['catalog', 'event', id],
    queryFn: ({ signal }) => repositories.catalog.event(id, signal),
    enabled: !!id,
  });
}
export function useSessions(id: string) {
  return useQuery({
    queryKey: ['catalog', 'sessions', id],
    queryFn: ({ signal }) => repositories.catalog.sessions(id, signal),
    enabled: !!id,
  });
}
export function useTicketTypes(id: string) {
  return useQuery({
    queryKey: ['catalog', 'types', id],
    queryFn: ({ signal }) => repositories.catalog.ticketTypes(id, signal),
    enabled: !!id,
  });
}
export function useLayout(id: string) {
  return useQuery({
    queryKey: ['catalog', 'layout', id],
    queryFn: ({ signal }) => repositories.catalog.layout(id, signal),
    enabled: !!id,
    staleTime: 300000,
  });
}
export function useAvailability(id: string) {
  return useQuery({
    queryKey: ['catalog', 'availability', id],
    queryFn: ({ signal }) => repositories.catalog.availability(id, signal),
    enabled: !!id,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
}
export function useSeatPricing(id: string) {
  return useQuery({
    queryKey: ['catalog', 'pricing', id],
    queryFn: ({ signal }) => repositories.catalog.seatPricing(id, signal),
    enabled: !!id,
    staleTime: 60000,
  });
}
