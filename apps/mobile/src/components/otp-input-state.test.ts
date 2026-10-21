import { describe, expect, it } from 'vitest';
import { backspaceOtp, editOtp, isCompleteOtp, OTP_LENGTH } from './otp-input-state';

describe('OTP cell editing', () => {
  it('advances after typing and replaces one digit without losing the others', () => {
    expect(editOtp('', 0, '1')).toEqual({ value: '1', focus: 1 });
    expect(editOtp('12345678', 2, '9')).toEqual({ value: '12945678', focus: 3 });
    expect(editOtp('1234567', 7, '8')).toEqual({ value: '12345678', focus: 7 });
  });

  it('accepts a full eight-digit paste or autofill from any cell and keeps eight cells', () => {
    expect(editOtp('98765432', 3, '1234 5678')).toEqual({ value: '12345678', focus: 7 });
    expect(editOtp('123456', 0, '87654321')).toEqual({ value: '87654321', focus: 7 });
    expect(editOtp('', 0, '1234567890')).toEqual({ value: '12345678', focus: 7 });
    expect(OTP_LENGTH).toBe(8);
  });

  it('supports partial paste and advances past the sixth digit to complete all eight', () => {
    expect(editOtp('12345678', 2, '89')).toEqual({ value: '12895678', focus: 4 });
    expect(editOtp('123456', 5, '67')).toEqual({ value: '1234567', focus: 7 });
  });

  it('clears a filled digit and moves back from an empty cell without shifting later digits', () => {
    expect(backspaceOtp('123456', 3)).toEqual({ value: '123 56', focus: 3 });
    expect(backspaceOtp('123', 3)).toEqual({ value: '12', focus: 2 });
    expect(backspaceOtp('', 0)).toEqual({ value: '', focus: 0 });
  });

  it('ignores nonnumeric typing and preserves gaps when a later cell is filled first', () => {
    expect(editOtp('12', 2, 'a')).toEqual({ value: '12', focus: 2 });
    expect(editOtp('', 2, '3')).toEqual({ value: '  3', focus: 3 });
  });

  it('only considers exactly eight digits a complete code', () => {
    expect(isCompleteOtp(' 12345678 ')).toBe(true);
    for (const value of ['', '123456', '1234567', '123456789', '1234567890', '123 5678', 'abcdefgh'])
      expect(isCompleteOtp(value)).toBe(false);
  });
});
