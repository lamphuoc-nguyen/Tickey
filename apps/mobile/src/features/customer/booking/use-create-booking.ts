import type { CreateBookingParams } from '@event/core';
import { useMutation } from '@tanstack/react-query';
import { repositories } from '@/lib/repositories';

// Create a booking (MT §19). No automatic retry: a retry is a user action and must reuse the
// same idempotencyKey, so the server returns the existing booking instead of a second one.
export function useCreateBooking() {
  return useMutation({
    mutationFn: (params: CreateBookingParams) => repositories.booking.createBooking(params),
    retry: false,
  });
}
