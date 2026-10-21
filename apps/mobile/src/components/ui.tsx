import { customerTheme } from '@event/ui-kit';
import { ApiError } from '@event/core';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const c = customerTheme.colors;
export const fonts = customerTheme.fonts;
export function Copy({ style, ...props }: TextProps) {
  return <Text {...props} style={[ui.body, style]} />;
}
export function Heading({ children, small = false }: PropsWithChildren<{ small?: boolean }>) {
  return (
    <Copy accessibilityRole="header" style={small ? ui.subheading : ui.heading}>
      {children}
    </Copy>
  );
}
export function Button({
  children,
  onPress,
  disabled,
  disabledReason,
  busy,
  secondary = false,
  testID,
}: PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  disabledReason?: string;
  busy?: boolean;
  secondary?: boolean;
  testID?: string;
}>) {
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || busy, busy }}
        disabled={disabled || busy}
        onPress={onPress}
        style={({ pressed }) => [
          ui.button,
          secondary && ui.secondary,
          (disabled || busy) && { opacity: 0.5 },
          pressed && { opacity: 0.8 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={secondary ? c.primary : 'white'} />
        ) : (
          <Copy style={[ui.buttonLabel, secondary && { color: c.primary }]}>{children}</Copy>
        )}
      </Pressable>
      {disabled && disabledReason && (
        <Copy accessibilityRole="text" style={{ color: c.muted, fontSize: 12, lineHeight: 19 }}>
          {disabledReason}
        </Copy>
      )}
    </View>
  );
}
export function Field({
  label,
  error,
  helper,
  ...props
}: TextInputProps & { label: string; error?: string; helper?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Copy style={ui.label}>{label}</Copy>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? helper}
        placeholderTextColor={c.muted}
        {...props}
        style={[ui.input, props.multiline && { height: 120, textAlignVertical: 'top' }, props.style]}
      />
      {error && (
        <Copy accessibilityRole="alert" style={{ color: c.primary }}>
          {error}
        </Copy>
      )}
      {!error && helper && <Copy style={ui.muted}>{helper}</Copy>}
    </View>
  );
}
export function Select<Value extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  disabledReason,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: string }[];
  onChange: (value: Value) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Copy style={ui.label}>{label}</Copy>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          ui.card,
          ui.row,
          { minHeight: 48, borderRadius: 10, justifyContent: 'space-between', opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <Copy style={{ flex: 1 }}>{options.find((option) => option.value === value)?.label ?? 'Chọn'}</Copy>
        <Icon name="chevron" />
      </Pressable>
      {disabled && disabledReason && <Copy style={ui.muted}>{disabledReason}</Copy>}
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <View
          accessibilityViewIsModal
          style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)', padding: 20 }}
        >
          <Card>
            <Heading small>{label}</Heading>
            <ScrollView style={{ maxHeight: 400 }}>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: option.value === value }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={{
                    padding: 16,
                    minHeight: 48,
                    backgroundColor: option.value === value ? c.tint : 'white',
                  }}
                >
                  <Copy>{option.label}</Copy>
                </Pressable>
              ))}
            </ScrollView>
            <Button secondary onPress={() => setOpen(false)}>
              Đóng
            </Button>
          </Card>
        </View>
      </Modal>
    </View>
  );
}
export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[ui.card, style]}>{children}</View>;
}
export function Notice({
  children,
  warning = false,
  success = false,
}: PropsWithChildren<{ warning?: boolean; success?: boolean }>) {
  return (
    <View
      accessibilityRole="text"
      style={[
        ui.notice,
        warning && { backgroundColor: c.amberTint },
        success && { backgroundColor: '#E8F5EF' },
      ]}
    >
      <Copy style={{ color: success ? '#237857' : warning ? c.amber : c.blue, fontSize: 12, lineHeight: 19 }}>
        {children}
      </Copy>
    </View>
  );
}
export function Icon({ name }: { name: keyof typeof icons }) {
  const icon = icons[name];
  return (
    <Image
      source={icon.source}
      style={{ width: icon.size, height: icon.size }}
      contentFit="contain"
      accessibilityIgnoresInvertColors
    />
  );
}
export const icons = {
  back: { source: require('../../assets/figma/1-895-imgFrame.svg'), size: 22 },
  bell: { source: require('../../assets/figma/1-722-imgFrame.svg'), size: 21 },
  search: { source: require('../../assets/figma/1-722-imgFrame2.svg'), size: 21 },
  chevron: { source: require('../../assets/figma/1-722-imgFrame1.svg'), size: 14 },
  music: { source: require('../../assets/figma/1-722-imgFrame3.svg'), size: 22 },
  building: { source: require('../../assets/figma/1-722-imgFrame4.svg'), size: 22 },
  users: { source: require('../../assets/figma/1-722-imgFrame5.svg'), size: 22 },
  calendar: { source: require('../../assets/figma/1-722-imgFrame6.svg'), size: 22 },
  home: { source: require('../../assets/figma/1-722-imgFrame7.svg'), size: 24 },
  ticket: { source: require('../../assets/figma/1-722-imgFrame8.svg'), size: 24 },
  notifications: { source: require('../../assets/figma/1-722-imgFrame9.svg'), size: 24 },
  account: { source: require('../../assets/figma/1-722-imgFrame10.svg'), size: 24 },
  calendarAccent: { source: require('../../assets/figma/1-895-imgFrame2.svg'), size: 20 },
  venue: { source: require('../../assets/figma/1-895-imgFrame3.svg'), size: 20 },
  shield: { source: require('../../assets/figma/1-895-imgFrame4.svg'), size: 24 },
  logo: { source: require('../../assets/figma/1-532-imgFrame2.svg'), size: 18 },
  clock: { source: require('../../assets/figma/1-1547-imgFrame2.svg'), size: 44 },
  expired: { source: require('../../assets/figma/1-1660-imgFrame2.svg'), size: 44 },
  empty: { source: require('../../assets/figma/1-4538-imgFrame2.svg'), size: 44 },
  network: { source: require('../../assets/figma/1-4580-imgFrame2.svg'), size: 44 },
  email: { source: require('../../assets/figma/1-618-imgFrame2.svg'), size: 44 },
  upload: { source: require('../../assets/figma/151-1603-imgFrame2.svg'), size: 24 },
};
export function Header({
  back = true,
  navigationEnabled = true,
}: {
  back?: boolean;
  navigationEnabled?: boolean;
}) {
  return (
    <View style={ui.header}>
      {back && navigationEnabled && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          style={ui.iconTarget}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Icon name="back" />
        </Pressable>
      )}
      <Copy style={[ui.wordmark, !back && { marginLeft: 20 }]}>TICKEY</Copy>
      {navigationEnabled && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông báo"
          style={ui.iconTarget}
          onPress={() => router.push('/notifications')}
        >
          <Icon name="bell" />
        </Pressable>
      )}
    </View>
  );
}
export function Screen({
  children,
  footer,
  back = true,
  navigationEnabled = true,
  scroll = true,
  refreshControl,
  contentStyle,
}: PropsWithChildren<{
  footer?: React.ReactNode;
  back?: boolean;
  navigationEnabled?: boolean;
  scroll?: boolean;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
  contentStyle?: ViewStyle;
}>) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      style={[ui.screen, { paddingTop: insets.top }]}
    >
      <Header back={back} navigationEnabled={navigationEnabled} />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
          contentContainerStyle={[
            ui.content,
            !footer && { paddingBottom: Math.max(insets.bottom, 24) },
            contentStyle,
          ]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
      {footer && <View style={[ui.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View>}
    </KeyboardAvoidingView>
  );
}
export function ActionFooter(props: React.ComponentProps<typeof Button>) {
  return <Button {...props} />;
}
export function ErrorNotice({ error }: { error: unknown }) {
  return <Notice warning>{errorMessage(error)}</Notice>;
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.details.reason === 'REQUEST_TIMEOUT')
      return 'Kết nối mất quá nhiều thời gian. Vui lòng thử lại.';
    if (error.details.reason === 'SESSION_SCOPE_CHANGED')
      return 'Tài khoản hoặc tổ chức đã thay đổi. Vui lòng kiểm tra lại trước khi tiếp tục.';
    if (error.details.reason === 'WORKSPACE_NOT_ACTIVATED')
      return 'Chưa thể xác nhận quyền truy cập. Vui lòng thử lại hoặc liên hệ người quản lý.';
    if (error.details.reason === 'AUTH_LINK_EXPIRED')
      return 'Mã hoặc liên kết xác thực không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu email mới.';
    if (error.details.reason === 'AUTH_RECOVERY_REQUIRED')
      return 'Vui lòng xác thực mã khôi phục trong email trước khi đặt mật khẩu mới.';
    if (error.details.reason === 'AUTH_SAME_PASSWORD') return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
    if (error.details.reason === 'AUTH_CALLBACK_FAILED')
      return 'Chưa thể xác thực bằng liên kết này. Vui lòng yêu cầu email mới hoặc quay về đăng nhập.';
    if (error.details.reason === 'INVALID_AUTH_CALLBACK')
      return 'Liên kết xác thực chưa đầy đủ hoặc không hợp lệ. Vui lòng mở liên kết mới nhất trong email.';
    if (error.details.reason === 'EMAIL_NOT_CONFIRMED')
      return 'Bạn cần xác nhận email trước khi đăng nhập. Mở email mới nhất hoặc yêu cầu gửi lại.';
    if (error.details.reason === 'AUTH_EMAIL_RATE_LIMIT')
      return 'Bạn đã yêu cầu quá nhiều lần. Vui lòng chờ một lúc rồi thử lại.';
    if (error.details.reason === 'AUTH_EMAIL_DELIVERY_FAILED')
      return 'Chưa thể gửi email xác thực. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.';
    if (error.details.reason === 'AUTH_EMAIL_NOT_AUTHORIZED')
      return 'Hiện chưa thể gửi email đến địa chỉ này. Vui lòng liên hệ hỗ trợ.';
    if (error.details.reason === 'AUTH_SERVICE_ERROR')
      return 'Dịch vụ xác thực đang gặp lỗi. Vui lòng thử lại sau.';
    if (error.code === 'UNAUTHENTICATED' && error.details.reason === 'INVALID_CREDENTIALS')
      return 'Email hoặc mật khẩu chưa đúng.';
    const messages: Partial<Record<ApiError['code'], string>> = {
      NETWORK: 'Không thể kết nối. Kiểm tra mạng và thử lại.',
      UNAUTHENTICATED: 'Vui lòng đăng nhập lại.',
      FORBIDDEN: 'Tài khoản không có quyền thực hiện thao tác này.',
      SEAT_CONFLICT: 'Một số ghế vừa được đặt. Lựa chọn còn lại chưa được giữ chỗ.',
      SOLD_OUT: 'Hạng vé hoặc khu vực đã hết chỗ.',
      LIMIT_EXCEEDED: 'Số vé vượt giới hạn cho phép.',
      SESSION_NOT_ON_SALE: 'Suất diễn hiện không bán vé. Vui lòng chọn suất khác.',
      BOOKING_EXPIRED: 'Đã hết thời gian giữ chỗ. Vui lòng chọn lại.',
      OTP_REQUIRED: 'Bạn cần xác thực OTP trước khi gửi tài khoản nhận hoàn.',
      MFA_REQUIRED: 'Thao tác cần xác thực bảo mật bổ sung. Vui lòng liên hệ hỗ trợ nếu chưa thiết lập.',
      DEVICE_REVOKED: 'Thiết bị không còn được phép thực hiện thao tác này. Vui lòng liên hệ người quản lý.',
      NOT_FOUND: 'Không tìm thấy thông tin này.',
      INVALID_STATE: 'Thao tác không còn phù hợp với trạng thái hiện tại.',
    };
    return (
      messages[error.code] ??
      (error.code === 'VALIDATION_FAILED'
        ? 'Thông tin chưa hợp lệ. Vui lòng kiểm tra và thử lại.'
        : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại hoặc liên hệ hỗ trợ.')
    );
  }
  return error instanceof Error && error.name === 'ZodError'
    ? 'Vui lòng kiểm tra các thông tin đã nhập.'
    : 'Có lỗi xảy ra. Vui lòng thử lại.';
}
export function QueryState({
  loading,
  error,
  empty,
  retry,
  emptyText = 'Chưa có nội dung.',
  compact = false,
}: {
  loading?: boolean;
  error?: unknown;
  empty?: boolean;
  retry?: () => void;
  emptyText?: string;
  compact?: boolean;
}) {
  if (loading && !error)
    return (
      <View style={ui.state}>
        <ActivityIndicator size="large" color={c.primary} />
        <Copy>Đang tải…</Copy>
      </View>
    );
  if (error)
    return (
      <View style={[ui.state, compact && { paddingVertical: 20 }]}>
        <Heading small>
          {error instanceof ApiError
            ? ((
                {
                  NETWORK: 'Không thể kết nối',
                  UNAUTHENTICATED: 'Vui lòng đăng nhập',
                  FORBIDDEN: 'Không đủ quyền truy cập',
                  NOT_FOUND: 'Không tìm thấy thông tin',
                } as Partial<Record<ApiError['code'], string>>
              )[error.code] ?? 'Chưa thể tải thông tin')
            : 'Chưa thể tải thông tin'}
        </Heading>
        <ErrorNotice error={error} />
        {!compact && error instanceof ApiError && error.code === 'NETWORK' && (
          <View
            style={{
              alignSelf: 'center',
              width: 112,
              height: 112,
              borderRadius: 56,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#FBEAED',
              marginVertical: 24,
            }}
          >
            <Icon name="network" />
          </View>
        )}
        {error instanceof ApiError && error.code === 'UNAUTHENTICATED' ? (
          <Button onPress={() => router.push('/auth/login')}>Đăng nhập</Button>
        ) : (
          retry && <Button onPress={retry}>Thử lại</Button>
        )}
      </View>
    );
  if (empty)
    return (
      <View style={[ui.state, compact && { paddingVertical: 20 }]}>
        <Heading small>{emptyText}</Heading>
        {!compact && (
          <View
            style={{
              alignSelf: 'center',
              width: 112,
              height: 112,
              borderRadius: 56,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#E8F5EF',
              marginVertical: 24,
            }}
          >
            <Icon name="empty" />
          </View>
        )}
      </View>
    );
  return null;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.background },
  content: { padding: 20, paddingTop: 16, paddingBottom: 24, gap: 16 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7 },
  iconTarget: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontFamily: fonts.semibold, fontSize: 11, color: c.muted, flex: 1 },
  body: { fontFamily: fonts.regular, color: c.text, fontSize: 13, lineHeight: 20 },
  heading: {
    fontFamily: fonts.heading,
    fontWeight: '700',
    fontSize: 25,
    lineHeight: 37,
    letterSpacing: -0.25,
  },
  subheading: { fontFamily: fonts.heading, fontWeight: '700', fontSize: 17, lineHeight: 25 },
  label: { fontFamily: fonts.semibold, fontSize: 12 },
  input: {
    backgroundColor: c.container,
    borderWidth: 1,
    borderColor: '#95716A',
    borderRadius: 4,
    minHeight: 56,
    padding: 16,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: c.text,
  },
  button: {
    minHeight: 50,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  buttonLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    color: 'white',
    textAlign: 'center',
  },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#95716A' },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  notice: { backgroundColor: c.blueTint, borderRadius: 12, padding: 12 },
  footer: {
    backgroundColor: c.container,
    borderTopWidth: 1,
    borderTopColor: c.border,
    padding: 20,
    paddingTop: 14,
    gap: 10,
  },
  state: { paddingVertical: 40, gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  muted: { color: c.muted },
  semibold: { fontFamily: fonts.semibold },
});
