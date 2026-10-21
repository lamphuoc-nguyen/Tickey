import { useState } from 'react';
import { bankInputSchema } from '@event/core';
import { useLocalSearchParams, router } from 'expo-router';
import { ActionFooter, Copy, Field, Heading, Notice, QueryState, Screen, ui } from '@/components/ui';
import { TextAction } from '@/components/customer-controls';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useRefund } from '@/features/customer/support/hooks/use-support-actions';
import { useFormDraft } from '@/features/forms/use-form-draft';
function Content() {
  const { refundId = '' } = useLocalSearchParams<{ refundId: string }>();
  const refund = useRefund(refundId);
  const { draft, update } = useFormDraft(`bank:${refundId}`, {
    bankCode: '',
    accountNumber: '',
    accountHolder: '',
  });
  const [checked, setChecked] = useState(false);
  const required = refund.data?.status === 'AWAITING_BANK_INFO';
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={!required || !!refund.error}
          disabledReason={
            refund.error
              ? 'Cần tải được yêu cầu hoàn trước khi tiếp tục.'
              : refund.isPending
                ? 'Đang tải yêu cầu hoàn.'
                : 'Yêu cầu hiện không cần bổ sung tài khoản ngân hàng.'
          }
          onPress={() => {
            setChecked(true);
            if (bankInputSchema.safeParse(draft).success)
              router.push({ pathname: '/refunds/[refundId]/otp', params: { refundId } });
          }}
        >
          Xác thực OTP
        </ActionFooter>
      }
    >
      <Heading>Tài khoản nhận hoàn tiền</Heading>
      <QueryState loading={refund.isPending} error={refund.error} retry={() => void refund.refetch()} />
      {required && <Copy style={ui.muted}>Xác nhận bằng mã gửi qua email trước khi lưu.</Copy>}
      <Field
        label="Mã ngân hàng"
        value={draft.bankCode}
        onChangeText={(bankCode) => update({ bankCode })}
        autoCapitalize="characters"
        error={checked && !draft.bankCode.trim() ? 'Nhập mã ngân hàng.' : undefined}
      />
      <Field
        label="Số tài khoản"
        value={draft.accountNumber}
        onChangeText={(accountNumber) => update({ accountNumber })}
        keyboardType="number-pad"
        error={
          checked && !/^\d{6,20}$/.test(draft.accountNumber) ? 'Số tài khoản cần 6–20 chữ số.' : undefined
        }
      />
      <Field
        label="Tên chủ tài khoản"
        value={draft.accountHolder}
        onChangeText={(accountHolder) => update({ accountHolder })}
        autoCapitalize="characters"
        error={checked && !draft.accountHolder.trim() ? 'Nhập tên chủ tài khoản.' : undefined}
      />
      {!required && !refund.isPending && !refund.error && (
        <Notice>Yêu cầu hiện không cần bổ sung tài khoản ngân hàng. Thông tin nhập chưa được gửi.</Notice>
      )}
      <TextAction onPress={() => router.replace('/refunds')}>Theo dõi hoàn tiền</TextAction>
    </Screen>
  );
}
export default function BankScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
