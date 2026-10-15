import { describe, it, expect } from 'vitest';
import { validateAuthForm } from './auth-validation';
const empty = { email: '', password: '', confirm: '', name: '', token: '' };
describe('auth form validation', () => {
  it('requires email/password for login but not signup-only fields', () => {
    expect(Object.keys(validateAuthForm('login', empty))).toEqual(['email', 'password']);
  });
  it('blocks reset with a short password or mismatched confirmation', () => {
    expect(validateAuthForm('reset', { ...empty, password: 'short', confirm: 'other' })).toHaveProperty(
      'confirm',
    );
    expect(validateAuthForm('reset', { ...empty, password: 'long-enough', confirm: 'long-enough' })).toEqual(
      {},
    );
  });
  it('does not submit an empty signup or invalid OTP', () => {
    expect(validateAuthForm('register', empty)).toHaveProperty('name');
    expect(validateAuthForm('verify', empty)).toHaveProperty('token');
  });
});
