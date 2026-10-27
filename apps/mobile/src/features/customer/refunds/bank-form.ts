import { bankInputSchema } from '@event/core';

export type BankDraft = { bankCode: string; accountNumber: string; accountHolder: string };

/** Pasted spaces are formatting, while letters and leading zeroes retain their meaning. */
export function validateBankDraft(draft: BankDraft) {
  const input = {
    ...draft,
    bankCode: draft.bankCode.trim(),
    accountNumber: draft.accountNumber.replace(/\s/g, ''),
    accountHolder: draft.accountHolder.trim(),
  };
  const result = bankInputSchema.safeParse(input);
  const errors: Partial<Record<keyof BankDraft, string>> = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof BankDraft;
      errors[field] = {
        bankCode: 'Nhập mã ngân hàng.',
        accountNumber: 'Số tài khoản cần 6–20 chữ số.',
        accountHolder: 'Nhập tên chủ tài khoản.',
      }[field];
    }
  }
  return { result, errors };
}
