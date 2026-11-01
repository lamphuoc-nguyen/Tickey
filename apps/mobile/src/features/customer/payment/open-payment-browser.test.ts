import { beforeEach, expect, it, vi } from 'vitest';
import { openPaymentBrowser } from './open-payment-browser';

const runtime = vi.hoisted(() => ({
  expoGo: true,
  browser: vi.fn(),
  authBrowser: vi.fn(),
  createURL: vi.fn(() => 'eventcustomer://payment-result'),
}));
vi.mock('expo', () => ({ isRunningInExpoGo: () => runtime.expoGo }));
vi.mock('expo-linking', () => ({ createURL: runtime.createURL }));
vi.mock('expo-web-browser', () => ({
  openBrowserAsync: runtime.browser,
  openAuthSessionAsync: runtime.authBrowser,
}));

beforeEach(() => {
  vi.clearAllMocks();
  runtime.expoGo = true;
  runtime.browser.mockResolvedValue({ type: 'opened' });
  runtime.authBrowser.mockResolvedValue({ type: 'cancel' });
});

const signedURL = 'https://staging.example.test/payments/test/order?sig=signature&return=signed-return';

it('opens the unchanged signed URL in Expo Go without waiting for an unregistered scheme', async () => {
  await openPaymentBrowser(signedURL);
  expect(runtime.browser).toHaveBeenCalledWith(signedURL);
  expect(runtime.authBrowser).not.toHaveBeenCalled();
  expect(runtime.createURL).not.toHaveBeenCalled();
});

it('uses the installed app scheme in a native build', async () => {
  runtime.expoGo = false;
  await openPaymentBrowser(signedURL);
  expect(runtime.createURL).toHaveBeenCalledWith('/payment-result', { scheme: 'eventcustomer' });
  expect(runtime.authBrowser).toHaveBeenCalledWith(signedURL, 'eventcustomer://payment-result');
  expect(runtime.browser).not.toHaveBeenCalled();
});

it('propagates a browser error rather than treating it as payment success', async () => {
  runtime.browser.mockRejectedValueOnce(new Error('Browser could not open'));
  await expect(openPaymentBrowser(signedURL)).rejects.toThrow('Browser could not open');
});
