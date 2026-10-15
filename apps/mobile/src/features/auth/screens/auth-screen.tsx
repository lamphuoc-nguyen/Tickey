import { useState } from 'react';
import { ApiError } from '@event/core';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
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
import { validateAuthForm } from '@/features/forms/auth-validation';

export function AuthScreen({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' | 'verify' }) {
  const params = useLocalSearchParams<{ email?: string; next?: string }>();
  const actions = useAuthActions();
  const auth = useAuth();
  const { draft, update, clear } = useFormDraft(`auth:${mode}`, {
    email: params.email ?? '',
    password: '',
    confirm: '',
    name: '',
    token: '',
  });
  const { email, password, confirm, name, token } = draft;
  const setEmail = (email: string) => update({ email });
  const setPassword = (password: string) => update({ password });
  const setConfirm = (confirm: string) => update({ confirm });
  const setName = (name: string) => update({ name });
  const setToken = (token: string) => update({ token });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');
  const current =
    actions[
      mode === 'login'
        ? 'login'
        : mode === 'register'
          ? 'register'
          : mode === 'forgot'
            ? 'forgot'
            : mode === 'reset'
              ? 'reset'
              : 'verify'
    ];
  const title = {
    login: 'Chào bạn trở lại',
    register: 'Tạo tài khoản',
    forgot: 'Quên mật khẩu',
    reset: 'Đặt lại mật khẩu',
    verify: 'Kiểm tra email của bạn',
  }[mode];
  const continueToAccount = () => router.replace({ pathname: '/workspaces', params: { next: params.next ?? '/' } });
  async function submit() {
    if (current.isPending) return;
    const errors = validateAuthForm(mode, draft);
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
        else router.replace({ pathname: '/auth/verify', params: { email, next: params.next ?? '/' } });
      }
      if (mode === 'forgot') {
        await actions.forgot.mutateAsync(email);
        setMessage('Nếu email thuộc tài khoản, bạn sẽ nhận được liên kết đặt lại mật khẩu.');
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
    } catch {
      /* The mutation error remains visible in the form. */
    }
  }
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={mode === 'reset' && !auth.session}
          disabledReason="Mở liên kết đặt lại mật khẩu gửi đến email trước khi tiếp tục."
          busy={current.isPending}
          onPress={() => void submit()}
        >
          {mode === 'login'
            ? 'Đăng nhập'
            : mode === 'register'
              ? 'Tạo tài khoản'
              : mode === 'forgot'
                ? 'Gửi liên kết'
                : mode === 'verify'
                  ? 'Xác nhận email'
                  : 'Lưu mật khẩu'}
        </ActionFooter>
      }
    >
      {mode !== 'verify' && (
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
      {mode !== 'verify' && (
        <Image
          source={
            mode !== 'register'
              ? require('../../../../assets/figma/1-532-imgPhotographyCrowd.png')
              : require('../../../../assets/figma/1-573-imgPhotographyOutdoor.png')
          }
          style={{ width: '100%', height: 130, borderRadius: 10, marginTop: 8, marginBottom: 4 }}
          contentFit="cover"
        />
      )}
      <Heading>{title}</Heading>
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
      {mode !== 'reset' && (
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
      )}
      {(mode === 'login' || mode === 'register' || mode === 'reset') && (
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
      {mode === 'reset' && (
        <>
          <Field
            label="Nhập lại mật khẩu"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            error={errors.confirm}
          />
          {!auth.session && (
            <Notice warning>Mở liên kết đặt lại mật khẩu gửi đến email trước khi tiếp tục.</Notice>
          )}
        </>
      )}
      {mode === 'verify' && (
        <>
          <View
            style={{
              alignSelf: 'center',
              width: 112,
              height: 112,
              borderRadius: 56,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FFF3D9',
              marginVertical: 16,
            }}
          >
            <Icon name="email" />
          </View>
          <Notice>
            Mở liên kết trong email mới nhất trên thiết bị đang dùng ứng dụng. Nếu email có mã xác thực, bạn
            có thể nhập mã tại đây.
          </Notice>
          <Field
            label="Mã xác nhận email"
            value={token}
            error={errors.token}
            keyboardType="number-pad"
            onChangeText={setToken}
            autoCapitalize="none"
            textContentType="oneTimeCode"
          />
          <Button
            secondary
            busy={actions.resendSignup.isPending}
            onPress={() =>
              void actions.resendSignup
                .mutateAsync(email)
                .then(() => setMessage('Đã gửi lại email xác thực.'))
                .catch(() => {})
            }
          >
            Gửi lại email
          </Button>
          {!!actions.resendSignup.error && <ErrorNotice error={actions.resendSignup.error} />}
        </>
      )}
      {mode === 'forgot' && <Copy>Chúng tôi sẽ gửi liên kết đặt lại mật khẩu.</Copy>}
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
            onPress={() =>
              router.push({ pathname: '/auth/verify', params: { email, next: params.next ?? '/' } })
            }
          >
            Xác nhận email · Gửi lại email
          </Button>
        )}
    </Screen>
  );
}
