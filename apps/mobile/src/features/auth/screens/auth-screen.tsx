import { useState } from 'react';
import { ApiError } from '@event/core';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Disclosure, TextAction } from '@/components/customer-controls';
import { OtpInput } from '@/components/otp-input';
import {
  ActionFooter,
  Button,
  Copy,
  ErrorNotice,
  Field,
  Heading,
  Icon,
  Notice,
  Screen,
  ui,
} from '@/components/ui';
import { useAuthActions } from '../hooks/use-auth-actions';
import { useAuth } from '../hooks/auth-context';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { validateAuthForm, type AuthMode } from '@/features/forms/auth-validation';
import { verificationTargetEmail } from '../verification-target';

export function AuthScreen({ mode }: { mode: AuthMode }) {
  const params = useLocalSearchParams<{ email?: string; next?: string }>();
  const actions = useAuthActions();
  const auth = useAuth();
  const isRecovery = mode === 'verify-recovery';
  const isVerification = mode === 'verify' || isRecovery;
  const targetEmail = verificationTargetEmail(params.email);
  const missingEmail = isVerification && !targetEmail;
  const canReset = !!auth.session?.passwordRecovery;
  const resend = isRecovery ? actions.forgot : actions.resendSignup;
  const { draft, update, clear } = useFormDraft(
    isVerification ? `auth:${mode}:${targetEmail}` : `auth:${mode}`,
    {
      email: targetEmail,
      password: '',
      confirm: '',
      name: '',
      token: '',
    },
  );
  const { password, confirm, name, token } = draft;
  const email = isVerification ? targetEmail : draft.email;
  const setEmail = (email: string) => update({ email });
  const setPassword = (password: string) => update({ password });
  const setConfirm = (confirm: string) => update({ confirm });
  const setName = (name: string) => update({ name });
  const setToken = (token: string) => update({ token });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const current = {
    login: actions.login,
    register: actions.register,
    forgot: actions.forgot,
    reset: actions.reset,
    verify: actions.verify,
    'verify-recovery': actions.verifyRecovery,
  }[mode];
  const title = {
    login: 'Chào bạn trở lại',
    register: 'Tạo tài khoản',
    forgot: 'Quên mật khẩu',
    reset: 'Đặt lại mật khẩu',
    verify: 'Xác nhận email',
    'verify-recovery': 'Nhập mã khôi phục',
  }[mode];
  const continueToAccount = () =>
    router.replace({ pathname: '/workspaces', params: { next: params.next ?? '/' } });
  async function submit() {
    if (missingEmail || current.isPending || (isVerification && resend.isPending)) return;
    const errors = validateAuthForm(mode, { ...draft, email });
    setErrors(errors);
    if (Object.keys(errors).length) return;
    setLocalError('');
    try {
      if (mode === 'login') {
        await actions.login.mutateAsync({ email, password });
        clear();
        continueToAccount();
      }
      if (mode === 'register') {
        const hasSession = await actions.register.mutateAsync({ email, password, name });
        clear();
        if (hasSession) continueToAccount();
        else
          router.replace({
            pathname: '/auth/verify',
            params: { email: email.trim(), next: params.next ?? '/' },
          });
      }
      if (mode === 'forgot') {
        await actions.forgot.mutateAsync(email);
        clear();
        router.replace({
          pathname: '/auth/verify-recovery',
          params: { email: email.trim(), next: params.next ?? '/' },
        });
      }
      if (mode === 'reset') {
        if (password !== confirm) {
          setLocalError('Hai mật khẩu chưa khớp.');
          return;
        }
        await actions.reset.mutateAsync(password);
        clear();
        continueToAccount();
      }
      if (mode === 'verify') {
        await actions.verify.mutateAsync({ email, token, signup: true });
        clear();
        continueToAccount();
      }
      if (isRecovery) {
        await actions.verifyRecovery.mutateAsync({ email, token });
        clear();
        router.replace({
          pathname: '/auth/reset',
          params: { email: email.trim(), next: params.next ?? '/' },
        });
      }
    } catch {
      /* The mutation error remains visible in the form. */
    }
  }
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={missingEmail || (mode === 'reset' && !canReset) || (isVerification && resend.isPending)}
          disabledReason={
            missingEmail
              ? 'Quay lại bước trước để chọn email cần xác minh.'
              : isVerification
                ? 'Đang yêu cầu email mới. Vui lòng chờ rồi nhập mã mới nhất.'
                : 'Xác thực mã khôi phục trong email trước khi đặt mật khẩu mới.'
          }
          busy={current.isPending}
          onPress={() => void submit()}
        >
          {mode === 'login'
            ? 'Đăng nhập'
            : mode === 'register'
              ? 'Tạo tài khoản'
              : mode === 'forgot'
                ? 'Gửi mã OTP'
                : isVerification
                  ? isRecovery
                    ? 'Xác thực mã OTP'
                    : 'Xác nhận email'
                  : 'Lưu mật khẩu'}
        </ActionFooter>
      }
    >
      {!isVerification && (
        <View style={ui.row}>
          <View
            style={{
              backgroundColor: '#D9422D',
              borderRadius: 8,
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Icon name="logo" />
          </View>
          <Heading>tickey</Heading>
        </View>
      )}
      {!isVerification && (
        <Image
          source={
            mode !== 'register'
              ? require('../../../../assets/figma/1-532-imgPhotographyCrowd.jpg')
              : require('../../../../assets/figma/1-573-imgPhotographyOutdoor.jpg')
          }
          style={{ width: '100%', height: 130, borderRadius: 10, marginTop: 8, marginBottom: 4 }}
          contentFit="cover"
        />
      )}
      {isVerification ? (
        <View style={[ui.row, { alignItems: 'flex-start' }]}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFF3D9',
            }}
          >
            <Icon name="email" />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Heading>{title}</Heading>
            <Copy style={ui.muted}>Nhập mã 8 số trong email mới nhất.</Copy>
          </View>
        </View>
      ) : (
        <Heading>{title}</Heading>
      )}
      {mode === 'login' && <Copy style={ui.muted}>Đăng nhập để mua vé hoặc vào ca làm được phân công.</Copy>}
      {mode === 'register' && (
        <Field
          label="Họ và tên"
          value={name}
          error={errors.name}
          onChangeText={setName}
          textContentType="name"
          autoComplete="name"
        />
      )}
      {isVerification ? (
        missingEmail ? (
          <Notice warning>Chưa có email cần xác minh. Vui lòng quay lại bước trước.</Notice>
        ) : (
          <View style={{ gap: 4 }}>
            <Copy style={ui.label}>Email xác minh</Copy>
            <Copy selectable style={ui.semibold}>
              {email}
            </Copy>
          </View>
        )
      ) : (
        mode !== 'reset' && (
          <Field
            label="Email"
            value={email}
            error={errors.email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
          />
        )
      )}
      {(mode === 'login' || mode === 'register' || (mode === 'reset' && canReset)) && (
        <Field
          label={mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
          value={password}
          error={errors.password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType={mode === 'login' ? 'password' : 'newPassword'}
          placeholder={mode !== 'login' ? 'Tối thiểu 8 ký tự' : undefined}
        />
      )}
      {mode === 'reset' && canReset && (
        <>
          <Notice>Đã xác thực email. Nhập mật khẩu mới để hoàn tất khôi phục tài khoản.</Notice>
          <Field
            label="Xác nhận mật khẩu mới"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            error={errors.confirm}
            textContentType="newPassword"
            autoComplete="new-password"
          />
        </>
      )}
      {mode === 'reset' && !canReset && (
        <>
          <Notice warning>
            Vui lòng nhận và xác thực mã khôi phục trong email trước khi đặt mật khẩu mới.
          </Notice>
          <Button onPress={() => router.replace('/auth/forgot')}>Nhận mã khôi phục</Button>
        </>
      )}
      {isVerification && (
        <>
          <OtpInput
            label={isRecovery ? 'Mã OTP khôi phục mật khẩu' : 'Mã xác nhận email'}
            value={token}
            error={errors.token}
            onChangeText={setToken}
            editable={!missingEmail && !current.isPending && !resend.isPending}
          />
          <TextAction
            busy={resend.isPending}
            disabled={missingEmail || current.isPending}
            disabledReason={
              missingEmail
                ? 'Quay lại bước trước để chọn email cần xác minh.'
                : 'Đang xác nhận mã. Vui lòng chờ kết quả.'
            }
            onPress={() => {
              if (missingEmail || resend.isPending || current.isPending) return;
              const emailError = validateAuthForm('verify', { ...draft, email }).email;
              if (emailError) {
                setErrors({ email: emailError });
                return;
              }
              setMessage('');
              setLocalError('');
              void resend
                .mutateAsync(email)
                .then(() => {
                  setToken('');
                  setErrors({});
                  current.reset();
                  setMessage('Yêu cầu gửi lại đã được tiếp nhận. Hãy kiểm tra email mới nhất.');
                })
                .catch(() => {});
            }}
          >
            {isRecovery ? 'Gửi lại mã OTP' : 'Gửi lại email'}
          </TextAction>
          {!!resend.error && <ErrorNotice error={resend.error} />}
          <Disclosure title="Không nhận được mã?">
            <Copy>
              Kiểm tra thư rác và địa chỉ email. Bạn có thể đọc email trên máy tính rồi nhập mã vào ứng dụng.
              {isRecovery
                ? ' Email khôi phục chỉ được gửi nếu địa chỉ đã đăng ký.'
                : ' Nếu email chỉ có liên kết, mở liên kết một lần rồi quay lại đăng nhập. Liên kết hết hạn cần được gửi lại.'}
            </Copy>
          </Disclosure>
          {isRecovery && (
            <TextAction
              disabled={current.isPending || resend.isPending}
              disabledReason="Vui lòng chờ yêu cầu hiện tại hoàn tất."
              onPress={() => {
                clear();
                router.replace('/auth/forgot');
              }}
            >
              Dùng email khác
            </TextAction>
          )}
          <TextAction
            disabled={current.isPending || resend.isPending}
            disabledReason="Vui lòng chờ thao tác xác nhận email hoàn tất."
            onPress={() =>
              router.replace({ pathname: '/auth/login', params: { email, next: params.next ?? '/' } })
            }
          >
            Quay lại đăng nhập
          </TextAction>
        </>
      )}
      {mode === 'forgot' && <Copy>Nhập email đã đăng ký để nhận mã OTP khôi phục mật khẩu.</Copy>}
      {mode === 'register' && (
        <Notice>Bằng việc tiếp tục, bạn đồng ý Điều khoản và Chính sách riêng tư của Tickey.</Notice>
      )}
      {mode === 'login' && (
        <>
          <Button
            secondary
            onPress={() => router.push({ pathname: '/auth/register', params: { next: params.next ?? '/' } })}
          >
            Tạo tài khoản
          </Button>
          <Button secondary onPress={() => router.push('/auth/forgot')}>
            Quên mật khẩu
          </Button>
        </>
      )}
      {!!message && <Notice>{message}</Notice>}
      {!!localError && <Notice warning>{localError}</Notice>}
      {!!current.error && <ErrorNotice error={current.error} />}
      {mode === 'login' &&
        current.error instanceof ApiError &&
        current.error.details.reason === 'EMAIL_NOT_CONFIRMED' && (
          <Button
            secondary
            disabled={!verificationTargetEmail(actions.login.variables?.email)}
            disabledReason="Vui lòng đăng nhập lại để xác định email cần xác minh."
            onPress={() =>
              router.push({
                pathname: '/auth/verify',
                params: {
                  email: verificationTargetEmail(actions.login.variables?.email),
                  next: params.next ?? '/',
                },
              })
            }
          >
            Xác nhận email · Gửi lại email
          </Button>
        )}
    </Screen>
  );
}
