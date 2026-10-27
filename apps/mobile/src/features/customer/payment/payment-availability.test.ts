import { expect, it } from 'vitest';
import { paidCheckoutAvailable } from './payment-availability';
it('keeps disabled, missing and simulated payment gateways out of real Customer checkout', () => {
  expect(paidCheckoutAvailable(false, 'VNPAY')).toBe(false);
  expect(paidCheckoutAvailable(true)).toBe(false);
  expect(paidCheckoutAvailable(true, '   ')).toBe(false);
  expect(paidCheckoutAvailable(true, ' test ')).toBe(false);
  expect(paidCheckoutAvailable(true, 'VNPAY')).toBe(true);
});
