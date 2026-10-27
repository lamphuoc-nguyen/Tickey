import { orderHistoryRoute } from '../tickets/order-presentation';

export function paymentReturnDestination(bookingId: string | undefined) {
  return bookingId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)
    ? { pathname: '/booking/[bookingId]' as const, params: { bookingId } }
    : orderHistoryRoute;
}
