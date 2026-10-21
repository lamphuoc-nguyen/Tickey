import { expect, it } from 'vitest';
import { verificationTargetEmail } from './verification-target';

it('normalizes the email carried from registration, login or recovery', () => {
  expect(verificationTargetEmail(' user+tickey@gmail.com ')).toBe('user+tickey@gmail.com');
});

it('requires a valid email before enabling verification or resend', () => {
  for (const value of ['', ' ', 'invalid', 'name@', 'name @gmail.com'])
    expect(verificationTargetEmail(value)).toBe('');
});

it('rejects ambiguous repeated email parameters instead of guessing an account', () => {
  for (const value of [undefined, null, ['one@gmail.com', 'two@gmail.com'], 123])
    expect(verificationTargetEmail(value)).toBe('');
});
