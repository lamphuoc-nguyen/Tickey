import { describe, expect, it } from 'vitest';
import { paymentReturnDestination } from './payment-return';

describe('retained payment callback route', () => {
  it('only directs a real-format booking ID to a server-backed booking screen', () => {
    const id = '00000000-0000-4000-8000-000000000001';
    expect(paymentReturnDestination(id)).toEqual({
      pathname: '/booking/[bookingId]',
      params: { bookingId: id },
    });
  });
  it('rejects incomplete/traversal IDs without inferring payment success', () => {
    for (const id of [undefined, '', '------------------------------------', 'orders/../staff', 'paid=true'])
      expect(paymentReturnDestination(id)).toBe('/orders');
  });
});
