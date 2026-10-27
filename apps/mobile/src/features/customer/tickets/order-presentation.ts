import type { Order } from '@event/core';

export type OrderView = 'tickets' | 'processing' | 'all' | 'saved';
/** Recovery/navigation links must not hide pending, expired or failed-to-return orders. */
export const orderHistoryRoute = { pathname: '/orders', params: { view: 'all' } } as const;
export function orderView(value?: string): OrderView {
  return value === 'processing' || value === 'all' || value === 'saved' ? value : 'tickets';
}
export function orderHasTickets(order: Pick<Order, 'status'>) {
  return order.status === 'CONFIRMED' || order.status === 'PARTIALLY_REFUNDED';
}
export function orderInView(order: Pick<Order, 'status'>, view: OrderView) {
  if (view === 'all') return true;
  if (view === 'tickets') return orderHasTickets(order);
  return (
    view === 'processing' && ['PENDING', 'PAYMENT_PENDING', 'PAID', 'REFUND_PENDING'].includes(order.status)
  );
}
