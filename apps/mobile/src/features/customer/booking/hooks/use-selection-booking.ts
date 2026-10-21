import { sessionIdentity, sessionScope } from '@/lib/session-scope';
import { ApiError, SeatConflictError, type BookingItemInput } from '@event/core';
import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateBooking } from '../use-create-booking';
import { bookingIntent } from '../booking-intent';
import { useBookingDraft } from '../draft-store';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { runExclusive } from '@/features/forms/exclusive-request';
import { useEffect, useRef } from 'react';

export function useSelectionBooking(sessionId: string, eventId: string) {
  const create = useCreateBooking();
  const { session } = useAuth();
  const currentScope = useRef(sessionIdentity(session));
  useEffect(() => {
    currentScope.current = sessionIdentity(session);
  }, [session]);
  const cache = useQueryClient();
  async function hold(items: BookingItemInput[]) {
    if ((!items.length && !useBookingDraft.getState().unresolved) || create.isPending) return;
    const next = `/sessions/${sessionId}/select?eventId=${encodeURIComponent(eventId)}`;
    if (!session) {
      router.push({ pathname: '/auth/login', params: { next } });
      return;
    }
    if (session.workspace.kind !== 'CUSTOMER') {
      router.push({ pathname: '/workspaces', params: { next } });
      return;
    }
    const draft = useBookingDraft.getState();
    const startedScope = sessionIdentity(session);
    const intent = bookingIntent(draft.intent, sessionId, items, randomUUID, draft.unresolved);
    draft.setIntent(intent);
    // Until the result is known, editing is blocked so retry retains the exact payload.
    draft.setUnresolved(true);
    try {
      const booking = await runExclusive(`booking:${session.userId}`, () => create.mutateAsync(intent));
      if (currentScope.current !== startedScope) return;
      draft.clear();
      cache.setQueryData(['booking', ...sessionScope(session), booking.id], {
        booking,
        receivedAt: performance.now(),
      });
      void cache.invalidateQueries({ queryKey: ['orders'] });
      router.push({
        pathname: booking.totalAmount === 0 ? '/booking/[bookingId]/result' : '/booking/[bookingId]',
        params: { bookingId: booking.id },
      });
    } catch (error) {
      if (currentScope.current !== startedScope) return;
      if (error instanceof SeatConflictError) {
        draft.conflict(error.seatIds);
        void cache.invalidateQueries({ queryKey: ['catalog', 'availability', sessionId] });
      } else if (error instanceof ApiError && error.code !== 'NETWORK' && error.code !== 'UNKNOWN')
        draft.setUnresolved(false);
      // NETWORK/UNKNOWN may mean the request committed: only replay this intent or inspect orders.
    }
  }
  return { hold, ...create };
}
