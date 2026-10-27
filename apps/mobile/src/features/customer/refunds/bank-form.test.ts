import { describe, expect, it } from 'vitest';
import { validateBankDraft } from './bank-form';

describe('bank form uses the existing boundary schema', () => {
  it('normalizes pasted spaces without losing account leading zeroes', () => {
    const { result } = validateBankDraft({
      bankCode: ' BANK ',
      accountNumber: ' 001 234 567 ',
      accountHolder: ' NGUYEN VAN A ',
    });
    expect(result.success && result.data).toEqual({
      bankCode: 'BANK',
      accountNumber: '001234567',
      accountHolder: 'NGUYEN VAN A',
    });
  });
  it('reports every failing field, including whitespace-only values', () => {
    expect(validateBankDraft({ bankCode: ' ', accountNumber: '123', accountHolder: ' ' }).errors).toEqual({
      bankCode: 'Nhập mã ngân hàng.',
      accountNumber: 'Số tài khoản cần 6–20 chữ số.',
      accountHolder: 'Nhập tên chủ tài khoản.',
    });
  });
  it('does not silently discard letters or truncate an invalid account number', () => {
    expect(
      validateBankDraft({ bankCode: 'BANK', accountNumber: '123abc456', accountHolder: 'A' }).result.success,
    ).toBe(false);
    expect(
      validateBankDraft({ bankCode: 'BANK', accountNumber: '1'.repeat(21), accountHolder: 'A' }).result
        .success,
    ).toBe(false);
  });
});
