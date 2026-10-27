import { useRef, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ActionFooter, Copy, Field, Heading, Notice, QueryState, Screen, ui } from '@/components/ui';
import { TextAction } from '@/components/customer-controls';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useRefund } from '@/features/customer/support/hooks/use-support-actions';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { validateBankDraft } from '../bank-form';
function Content() {
  const { refundId = '' } = useLocalSearchParams<{ refundId: string }>();
  const refund = useRefund(refundId);
  const { draft, update } = useFormDraft(`bank:${refundId}`, {
    bankCode: '',
    accountNumber: '',
    accountHolder: '',
  });
  const [checked, setChecked] = useState(false);
  const numberInput = useRef<TextInput>(null);
  const holderInput = useRef<TextInput>(null);
  const validation = validateBankDraft(draft);
  const editable = !!refund.data && !refund.error && refund.data.status === 'AWAITING_BANK_INFO';
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
            if (validation.result.success) {
              update(validation.result.data);
              router.push({ pathname: '/refunds/[refundId]/otp', params: { refundId } });
            }
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
        editable={editable}
        onChangeText={(bankCode) => update({ bankCode })}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => numberInput.current?.focus()}
        error={checked ? validation.errors.bankCode : undefined}
      />
      <Field
        label="Số tài khoản"
        inputRef={numberInput}
        value={draft.accountNumber}
        editable={editable}
        onChangeText={(accountNumber) => update({ accountNumber })}
        keyboardType="number-pad"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => holderInput.current?.focus()}
        error={checked ? validation.errors.accountNumber : undefined}
      />
      <Field
        label="Tên chủ tài khoản"
        inputRef={holderInput}
        value={draft.accountHolder}
        editable={editable}
        onChangeText={(accountHolder) => update({ accountHolder })}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        error={checked ? validation.errors.accountHolder : undefined}
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
