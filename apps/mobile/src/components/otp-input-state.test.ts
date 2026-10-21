import { describe, expect, it } from 'vitest';
import { backspaceOtp, editOtp, otpCellCount } from './otp-input-state';

describe('OTP cell editing', () => {
  it('advances after typing and replaces one digit without losing the others', () => {
    expect(editOtp('', 0, '1')).toEqual({ value: '1', focus: 1 });
    expect(editOtp('123456', 2, '9')).toEqual({ value: '129456', focus: 3 });
    expect(editOtp('12345', 5, '6')).toEqual({ value: '123456', focus: 5 });
  });

  it('accepts full pasted or autofilled codes from any cell, including longer server codes', () => {
    expect(editOtp('987654', 3, '123 456')).toEqual({ value: '123456', focus: 5 });
    expect(editOtp('123456', 0, '87654321')).toEqual({ value: '87654321', focus: 7 });
    expect(editOtp('', 0, '1234567890')).toEqual({ value: '1234567890', focus: 9 });
    expect(editOtp('', 0, '12345678901').value).toBe('1234567890');
    expect(otpCellCount('87654321')).toBe(8);
  });

  it('supports partial paste and typing beyond six digits without truncating the code', () => {
    expect(editOtp('123456', 2, '89')).toEqual({ value: '128956', focus: 4 });
    expect(editOtp('123456', 5, '67')).toEqual({ value: '1234567', focus: 6 });
  });

  it('clears a filled digit and moves back from an empty cell without shifting later digits', () => {
    expect(backspaceOtp('123456', 3)).toEqual({ value: '123 56', focus: 3 });
    expect(backspaceOtp('123', 3)).toEqual({ value: '12', focus: 2 });
    expect(backspaceOtp('', 0)).toEqual({ value: '', focus: 0 });
    expect(otpCellCount('')).toBe(6);
  });

  it('ignores nonnumeric typing and preserves gaps when a later cell is filled first', () => {
    expect(editOtp('12', 2, 'a')).toEqual({ value: '12', focus: 2 });
    expect(editOtp('', 2, '3')).toEqual({ value: '  3', focus: 3 });
  });
});
