import { useState } from 'react';
import { bankInputSchema } from '@event/core';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ActionFooter,
  Button,
  ErrorNotice,
  Field,
  Heading,
  Notice,
  QueryState,
  Screen,
} from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { useAuthActions } from '@/features/auth/hooks/use-auth-actions';
import { useRefund, useSupportActions } from '@/features/customer/support/hooks/use-support-actions';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { submitVerifiedBankInfo } from '../bank-submission';
function Content() {
  const { refundId = '' } = useLocalSearchParams<{ refundId: string }>();
  const refund = useRefund(refundId);
  const auth = useAuth();
  const actions = useAuthActions();
  const { bankInfo } = useSupportActions();
  const bank = useFormDraft(`bank:${refundId}`, { bankCode: '', accountNumber: '', accountHolder: '' });
  const verification = useFormDraft(`bank-otp:${refundId}`, { otp: '', sent: false });
  const { otp, sent } = verification.draft;
  const setOtp = (otp: string) => verification.update({ otp });
  const [error, setError] = useState('');
  const verificationScope = `${auth.session?.userId ?? ''}:${refundId}`;
  const [verifiedScope, setVerifiedScope] = useState<string | null>(null);
  const verified = verifiedScope === verificationScope;
  const setVerified = (value: boolean) => setVerifiedScope(value ? verificationScope : null);
  const busy = actions.otp.isPending || actions.verify.isPending || bankInfo.isPending;
  const allowed =
    refund.data?.status === 'AWAITING_BANK_INFO' &&
    !refund.error &&
    !!auth.session?.email &&
    bankInputSchema.safeParse(bank.draft).success;
  async function submit() {
    if (!allowed || busy || !auth.session) return;
    if (!verified && !/^\d{6,10}$/.test(otp.trim())) {
      setError('Nhập mã xác thực gửi đến email.');
      return;
    }
    setError('');
    try {
      const email = auth.session.email;
      await submitVerifiedBankInfo({
        verified,
        setVerified,
        verify: () => actions.verify.mutateAsync({ email, token: otp.trim() }),
        submit: () => bankInfo.mutateAsync({ id: refundId, input: bank.draft }),
      });
      bank.clear();
      verification.clear();
      router.replace({ pathname: '/refunds/[refundId]', params: { refundId } });
    } catch {
      /* Auth/bank errors remain visible, entered bank details are retained. */
    }
  }
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={!allowed || !sent || bankInfo.isSuccess}
          disabledReason={
            !allowed
              ? 'Cần yêu cầu hoàn đang chờ tài khoản ngân hàng và thông tin tài khoản hợp lệ.'
              : 'Gửi mã xác thực đến email trước khi xác nhận.'
          }
          busy={busy}
          onPress={() => void submit()}
        >
          Xác nhận
        </ActionFooter>
      }
    >
      <Heading>Xác thực OTP</Heading>
      <QueryState loading={refund.isPending} error={refund.error} retry={() => void refund.refetch()} />
      <Field
        label="Mã xác thực"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        editable={!busy && !verified}
        error={error}
        placeholder="Nhập mã được gửi tới bạn."
      />
      <Notice>Mã xác thực dùng để xác nhận tài khoản nhận hoàn tiền.</Notice>
      {verified && (
        <Notice>
          Đã xác thực email. Bạn có thể thử gửi lại thông tin nhận hoàn nếu kết nối bị gián đoạn.
        </Notice>
      )}
      <Button
        secondary
        busy={actions.otp.isPending}
        disabled={!allowed || busy}
        disabledReason="Cần kiểm tra thông tin nhận hoàn trước khi gửi mã."
        onPress={() => {
          if (auth.session)
            void actions.otp
              .mutateAsync(auth.session.email)
              .then(() => {
                setVerified(false);
                setError('');
                actions.verify.reset();
                bankInfo.reset();
                verification.update({ sent: true, otp: '' });
              })
              .catch(() => {});
        }}
      >
        {sent ? 'Gửi lại mã' : 'Gửi mã xác thực đến email'}
      </Button>
      {sent && <Notice>Đã gửi mã đến email của tài khoản.</Notice>}
      {!!actions.otp.error && <ErrorNotice error={actions.otp.error} />}{' '}
      {!!actions.verify.error && <ErrorNotice error={actions.verify.error} />}{' '}
      {!!bankInfo.error && <ErrorNotice error={bankInfo.error} />}
      <Button
        secondary
        disabled={busy}
        disabledReason="Đang xác nhận thông tin."
        onPress={() => router.back()}
      >
        Quay lại thông tin tài khoản
      </Button>
    </Screen>
  );
}
export default function OtpScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
