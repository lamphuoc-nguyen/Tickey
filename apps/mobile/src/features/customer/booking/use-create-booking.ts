import type { CreateBookingParams } from '@event/core';
import { useMutation } from '@tanstack/react-query';
import { repositories } from '@/lib/repositories';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { runScopedRequest } from '@/features/forms/scoped-request';

// Create a booking (MT §19). No automatic retry: a retry is a user action and must reuse the
// same idempotencyKey, so the server returns the existing booking instead of a second one.
export function useCreateBooking() {
  const { session } = useAuth();
  return useMutation({
    mutationFn: (params: CreateBookingParams) =>
      runScopedRequest(
        session,
        () => repositories.auth.session(),
        () => repositories.booking.createBooking(params),
      ),
    retry: false,
  });
}
