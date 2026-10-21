import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@event/core';
import { submitVerifiedBankInfo } from './bank-submission';

describe('refund bank OTP and retry', () => {
  it('retries a failed bank request without reusing the consumed OTP', async () => {
    let verified = false;
    const verify = vi.fn(async () => undefined);
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('NETWORK'))
      .mockResolvedValueOnce({ approvalId: null });
    const run = () =>
      submitVerifiedBankInfo({
        verified,
        verify,
        submit,
        setVerified: (value) => {
          verified = value;
        },
      });
    await expect(run()).rejects.toMatchObject({ code: 'NETWORK' });
    expect(verified).toBe(true);
    await expect(run()).resolves.toEqual({ approvalId: null });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(2);
  });
  it('requires another verification when the server rejects freshness', async () => {
    let verified = true;
    const setVerified = (value: boolean) => {
      verified = value;
    };
    await expect(
      submitVerifiedBankInfo({
        verified,
        setVerified,
        verify: vi.fn(),
        submit: async () => {
          throw new ApiError('OTP_REQUIRED');
        },
      }),
    ).rejects.toMatchObject({ code: 'OTP_REQUIRED' });
    expect(verified).toBe(false);
  });
  it('never sends bank information after an invalid OTP', async () => {
    const submit = vi.fn();
    await expect(
      submitVerifiedBankInfo({
        verified: false,
        setVerified: vi.fn(),
        submit,
        verify: async () => {
          throw new ApiError('VALIDATION_FAILED');
        },
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(submit).not.toHaveBeenCalled();
  });
});
