import { beforeEach, expect, it, vi } from 'vitest';
import { usePayment } from './use-payment';
import { ApiError } from '@event/core';

type Mutation = {
  mutationFn: (variables: void, assertCurrent: () => Promise<void>) => Promise<unknown>;
  onSuccess: (booking: { status: string }) => unknown;
};
const runtime = vi.hoisted(() => ({
  configuration: {
    available: true,
    gateway: 'TEST',
    isTest: true,
    unavailableReason: 'Thanh toán thử chưa được bật cho môi trường này.',
  },
  create: vi.fn(),
  confirm: vi.fn(),
  getBooking: vi.fn(),
  browser: vi.fn(),
  assertCurrent: vi.fn(),
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn(),
  replace: vi.fn(),
  exclusive: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: runtime.setQueryData,
    invalidateQueries: runtime.invalidateQueries,
  }),
}));
vi.mock('@/lib/session-scope', () => import('../../../../lib/session-scope'));
vi.mock('@/features/auth/hooks/auth-context', () => ({
  useAuth: () => ({ session: { userId: 'account-a', workspace: { kind: 'CUSTOMER', orgId: null } } }),
}));
vi.mock('@/features/forms/use-exclusive-mutation', () => ({
  useExclusiveMutation: (scope: string, options: Mutation) => {
    runtime.exclusive(scope);
    return options;
  },
}));
vi.mock('@/lib/repositories', () => ({
  repositories: {
    payment: { createPaymentSession: runtime.create, confirmTestPayment: runtime.confirm },
    booking: { getBooking: runtime.getBooking },
  },
}));
vi.mock('expo-router', () => ({ router: { replace: runtime.replace } }));
vi.mock('../payment-configuration', () => ({ getPaymentConfiguration: () => runtime.configuration }));
vi.mock('../open-payment-browser', () => ({ openPaymentBrowser: runtime.browser }));

// Test the mutation operation; this is not a mounted native component test.
const buildMutation = usePayment as unknown as (id: string) => Mutation;
const booking = { id: 'booking-a', status: 'PAYMENT_PENDING' };

beforeEach(() => {
  vi.clearAllMocks();
  runtime.configuration.available = true;
  runtime.configuration.isTest = true;
  runtime.create.mockResolvedValue({ paymentUrl: 'https://staging.example.test/payments/test/order' });
  runtime.getBooking.mockResolvedValue(booking);
  runtime.confirm.mockResolvedValue(undefined);
  runtime.browser.mockResolvedValue({
    type: 'success',
    url: 'eventcustomer://payment-result?status=success',
  });
  runtime.assertCurrent.mockResolvedValue(undefined);
});

it('blocks a disabled test environment before any write or browser operation', async () => {
  runtime.configuration.available = false;
  await expect(buildMutation('booking-a').mutationFn(undefined, runtime.assertCurrent)).rejects.toThrow(
    'chưa được bật',
  );
  expect(runtime.create).not.toHaveBeenCalled();
  expect(runtime.browser).not.toHaveBeenCalled();
});

it('submits TEST directly without opening a browser and preserves server pending', async () => {
  await buildMutation('booking-a').mutationFn(undefined, runtime.assertCurrent);
  expect(runtime.exclusive).toHaveBeenCalledWith('payment:booking-a');
  expect(runtime.create).toHaveBeenCalledWith('booking-a', 'TEST');
  expect(runtime.getBooking).toHaveBeenCalledWith('booking-a');
  expect(runtime.confirm).toHaveBeenCalledWith({
    paymentUrl: 'https://staging.example.test/payments/test/order',
  });
  expect(runtime.browser).not.toHaveBeenCalled();
  expect(runtime.setQueryData).toHaveBeenCalledWith(['booking', 'account-a', 'CUSTOMER', null, 'booking-a'], {
    booking,
    receivedAt: expect.any(Number),
  });
});

it('refreshes a possibly committed booking after session creation fails without opening the browser', async () => {
  runtime.create.mockRejectedValueOnce(new Error('Connection lost'));
  await expect(buildMutation('booking-a').mutationFn(undefined, runtime.assertCurrent)).rejects.toThrow(
    'Connection lost',
  );
  expect(runtime.getBooking).toHaveBeenCalledWith('booking-a');
  expect(runtime.browser).not.toHaveBeenCalled();
  expect(runtime.setQueryData).toHaveBeenCalled();
});

it('refreshes after closing or failing to open the browser and does not invent a result', async () => {
  runtime.configuration.isTest = false;
  runtime.browser.mockRejectedValueOnce(new Error('Browser failed'));
  await expect(buildMutation('booking-a').mutationFn(undefined, runtime.assertCurrent)).rejects.toThrow(
    'Browser failed',
  );
  expect(runtime.getBooking).toHaveBeenCalledWith('booking-a');
  expect(runtime.setQueryData.mock.calls[0]?.[1].booking.status).toBe('PAYMENT_PENDING');
});

it('opens a browser for a real gateway instead of posting the TEST confirmation', async () => {
  runtime.configuration.isTest = false;
  await buildMutation('booking-a').mutationFn(undefined, runtime.assertCurrent);
  expect(runtime.browser).toHaveBeenCalled();
  expect(runtime.confirm).not.toHaveBeenCalled();
});

it('accepts an uncertain redirect only when server independently confirms payment', async () => {
  runtime.confirm.mockRejectedValueOnce(new ApiError('NETWORK'));
  runtime.getBooking.mockResolvedValueOnce({ ...booking, status: 'PAID' });
  await expect(
    buildMutation('booking-a').mutationFn(undefined, runtime.assertCurrent),
  ).resolves.toMatchObject({ status: 'PAID' });
});

it('does not turn a failed or unconfirmed TEST write into successful payment', async () => {
  runtime.confirm.mockRejectedValueOnce(new ApiError('NETWORK'));
  await expect(buildMutation('booking-a').mutationFn(undefined, runtime.assertCurrent)).rejects.toMatchObject(
    { code: 'NETWORK' },
  );
  expect(runtime.setQueryData.mock.calls[0]?.[1].booking.status).toBe('PAYMENT_PENDING');
});

it('preserves explicit rejection even if an old booking status is paid', async () => {
  runtime.confirm.mockRejectedValueOnce(new ApiError('FORBIDDEN'));
  runtime.getBooking.mockResolvedValueOnce({ ...booking, status: 'PAID' });
  await expect(buildMutation('booking-a').mutationFn(undefined, runtime.assertCurrent)).rejects.toMatchObject(
    { code: 'FORBIDDEN' },
  );
});

it('goes directly to tickets only for paid or confirmed server status', () => {
  const operation = buildMutation('booking-a');
  operation.onSuccess({ status: 'CONFIRMED' });
  expect(runtime.replace).toHaveBeenLastCalledWith({
    pathname: '/booking/[bookingId]/result',
    params: { bookingId: 'booking-a' },
  });
  operation.onSuccess({ status: 'PAID' });
  expect(runtime.replace).toHaveBeenLastCalledWith({
    pathname: '/booking/[bookingId]/result',
    params: { bookingId: 'booking-a' },
  });
  operation.onSuccess({ status: 'PAYMENT_PENDING' });
  expect(runtime.replace).toHaveBeenLastCalledWith({
    pathname: '/booking/[bookingId]',
    params: { bookingId: 'booking-a' },
  });
});

it('does not publish a late booking into the cache after the account changes', async () => {
  runtime.getBooking.mockImplementationOnce(async () => {
    runtime.assertCurrent.mockRejectedValue(new Error('Account changed'));
    return booking;
  });
  await expect(buildMutation('booking-a').mutationFn(undefined, runtime.assertCurrent)).rejects.toThrow(
    'Account changed',
  );
  expect(runtime.setQueryData).not.toHaveBeenCalled();
  expect(runtime.invalidateQueries).not.toHaveBeenCalled();
});
