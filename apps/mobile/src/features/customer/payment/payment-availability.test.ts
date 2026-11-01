import { afterEach, expect, it, vi } from 'vitest';
import { paidCheckoutAvailable } from './payment-availability';
import { getPaymentConfiguration } from './payment-configuration';

vi.mock('@/lib/capabilities', () => ({ customerCapabilities: { gatewayPayment: true } }));
afterEach(() => vi.unstubAllEnvs());

it('allows direct checkout without a configured mobile gateway', () => {
  expect(paidCheckoutAvailable(true)).toBe(true);
  expect(paidCheckoutAvailable(false)).toBe(false);
});

it('does not require payment flags, a particular host or a development runtime', () => {
  vi.stubEnv('EXPO_PUBLIC_PAYMENT_GATEWAY', '');
  vi.stubEnv('EXPO_PUBLIC_PAYMENT_TEST_MODE', '');
  expect(getPaymentConfiguration()).toMatchObject({ available: true, gateway: 'TEST', isTest: true });
});

it('does not let old local payment settings redirect direct confirmation', () => {
  vi.stubEnv('EXPO_PUBLIC_PAYMENT_GATEWAY', 'OLD_GATEWAY');
  vi.stubEnv('EXPO_PUBLIC_PAYMENT_TEST_MODE', 'false');
  expect(getPaymentConfiguration()).toMatchObject({ available: true, gateway: 'TEST', isTest: true });
});
