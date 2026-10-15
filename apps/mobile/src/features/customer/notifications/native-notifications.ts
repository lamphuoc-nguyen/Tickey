import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

type NativeNotifications = typeof import('expo-notifications');
let pending: Promise<NativeNotifications> | undefined;

export function deviceReminderUnavailableReason(): string | null {
  if (Platform.OS === 'web')
    return 'Nhắc lịch trên thiết bị chưa được hỗ trợ trong trình duyệt. Bạn vẫn có thể xem thông báo trong ứng dụng.';
  if (Platform.OS === 'android' && isRunningInExpoGo())
    return 'Nhắc lịch trên thiết bị chưa được hỗ trợ trong phiên bản bạn đang dùng. Bạn vẫn có thể xem thông báo trong ứng dụng.';
  return null;
}

/** The SDK entry imports push-token registration eagerly, which throws in Android Expo Go. */
export async function loadNativeNotifications(): Promise<NativeNotifications | null> {
  if (deviceReminderUnavailableReason()) return null;
  pending ??= import('expo-notifications').catch((error: unknown) => {
    pending = undefined;
    throw error;
  });
  return pending;
}
