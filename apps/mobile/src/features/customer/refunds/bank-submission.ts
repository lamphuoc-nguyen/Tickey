import { ApiError } from '@event/core';

/** OTP is single-use. A failed bank request must not consume the same code a second time. */
export async function submitVerifiedBankInfo<T>(input: {
  verified: boolean;
  verify: () => Promise<unknown>;
  submit: () => Promise<T>;
  setVerified: (value: boolean) => void;
}): Promise<T> {
  if (!input.verified) {
    await input.verify();
    input.setVerified(true);
  }
  try {
    return await input.submit();
  } catch (error) {
    if (error instanceof ApiError && (error.code === 'OTP_REQUIRED' || error.code === 'UNAUTHENTICATED'))
      input.setVerified(false);
    throw error;
  }
}
