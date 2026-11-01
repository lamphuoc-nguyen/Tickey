import { ApiError, type Booking } from '@event/core';
import { repositories } from '@/lib/repositories';
import { getPaymentConfiguration } from './payment-configuration';
import { openPaymentBrowser } from './open-payment-browser';

/**
 * Opens the payment session and finishes it the way the server's gateway asks. Only the reloaded booking says
 * whether money arrived, so `onBooking` runs with it even when the attempt throws afterwards.
 */
export async function runCheckout(
  bookingId: string,
  assertCurrent: () => Promise<void>,
  onBooking: (booking: Booking) => void,
): Promise<{ booking: Booking; testMode: boolean }> {
  const configuration = getPaymentConfiguration();
  const gateway = configuration.gateway;
  if (!configuration.available || !gateway) throw new Error(configuration.unavailableReason);
  let failure: unknown;
  let testMode = configuration.isTest;
  try {
    const payment = await repositories.payment.createPaymentSession(bookingId, gateway);
    await assertCurrent();
    // The server's gateway decides; a real gateway must not be sent through the test form.
    testMode = payment.mode ? payment.mode === 'TEST' : configuration.isTest;
    if (testMode) await repositories.payment.confirmTestPayment(payment);
    else await openPaymentBrowser(payment.paymentUrl);
  } catch (error) {
    failure = error;
  }
  // Only server status resolves an uncertain write (including a failed app-scheme redirect).
  await assertCurrent();
  const booking = await repositories.booking.getBooking(bookingId);
  await assertCurrent();
  onBooking(booking);
  const recorded = booking.status === 'PAID' || booking.status === 'CONFIRMED';
  const uncertainTestResult = testMode && failure instanceof ApiError && failure.code === 'NETWORK';
  if (failure && !(uncertainTestResult && recorded)) throw failure;
  return { booking, testMode };
}
