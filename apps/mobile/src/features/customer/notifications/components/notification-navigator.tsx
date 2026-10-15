import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { NotificationResponse } from 'expo-notifications';
import { router, useRootNavigationState } from 'expo-router';
import { Button, Notice } from '@/components/ui';
import { notificationDestination } from '../notification-destination';
import { loadNativeNotifications } from '../native-notifications';

export function NotificationNavigator() {
  const navigation = useRootNavigationState();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!navigation?.key) return;
    let disposed = false;
    let subscription: { remove: () => void } | undefined;
    const initialize = async () => {
      const Notifications = await loadNativeNotifications();
      if (disposed || !Notifications) return;
      const handle = (response: NotificationResponse | null) => {
        if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const destination = notificationDestination(response.notification.request.content.data);
        if (destination.kind === 'ticket')
          router.push({ pathname: '/tickets/[ticketId]', params: { ticketId: destination.id } });
        else if (destination.kind === 'booking')
          router.push({ pathname: '/booking/[bookingId]', params: { bookingId: destination.id } });
        else router.push(destination.kind === 'tickets' ? '/tickets' : '/notifications');
        Notifications.clearLastNotificationResponse();
      };
      subscription = Notifications.addNotificationResponseReceivedListener(handle);
      handle(Notifications.getLastNotificationResponse());
    };
    void initialize().catch(() => {
      if (!disposed) setFailed(true);
    });
    return () => {
      disposed = true;
      subscription?.remove();
    };
  }, [navigation?.key, attempt]);
  if (!failed) return null;
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Notice warning>
        Chưa thể mở thông báo trên thiết bị. Bạn vẫn có thể xem danh sách thông báo trong ứng dụng.
      </Notice>
      <Button
        secondary
        onPress={() => {
          setFailed(false);
          setAttempt((value) => value + 1);
        }}
      >
        Thử lại
      </Button>
    </View>
  );
}
