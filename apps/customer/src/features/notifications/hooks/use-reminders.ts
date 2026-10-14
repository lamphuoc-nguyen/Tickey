import { useExclusiveMutation } from '@/features/forms/use-exclusive-mutation';
import { Platform } from 'react-native';
import type { NotificationPreferences, Ticket } from '@event/core';
import { repositories } from '@/lib/repositories';
import { useAuth } from '@/features/auth/hooks/auth-context';
import { reminderPlan } from '../reminder-plan';
import { deviceReminderUnavailableReason, loadNativeNotifications } from '../native-notifications';

export async function clearLocalReminders(userId: string) {
  const Notifications = await loadNativeNotifications();
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(`tickey:${userId}:`))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}
export function useScheduleReminders() {
  const { session } = useAuth();
  return useExclusiveMutation('schedule-reminders', {
    mutationFn: async (preferences: NotificationPreferences) => {
      if (!session) throw new Error('Cần đăng nhập.');
      const unavailable = deviceReminderUnavailableReason();
      if (unavailable) return unavailable;
      const Notifications = await loadNativeNotifications();
      if (!Notifications)
        return 'Chưa thể tạo nhắc lịch trên thiết bị. Bạn vẫn có thể xem thông báo trong ứng dụng.';
      if (!preferences.pushEnabled || (!preferences.reminder24h && !preferences.reminder2h)) {
        await clearLocalReminders(session.userId);
        return 'Đã tắt nhắc lịch trên thiết bị.';
      }
      if (preferences.pushEnabled) {
        if (Platform.OS === 'android')
          await Notifications.setNotificationChannelAsync('events', {
            name: 'Nhắc lịch sự kiện',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
        if (!permission.granted)
          return 'Đã lưu tùy chọn. Chưa thể tạo nhắc trên thiết bị vì quyền thông báo chưa được cấp.';
      }
      // Fetch every page before reconciling; a first page cannot determine whether older reminders are stale.
      const tickets: Ticket[] = [];
      let offset = 0;
      while (true) {
        const page = await repositories.customer.tickets(offset);
        tickets.push(...page);
        if (page.length < 20) break;
        offset += 20;
      }
      const current = await repositories.auth.session();
      if (current?.userId !== session.userId || current.workspace.kind !== 'CUSTOMER')
        throw new Error('Tài khoản đã thay đổi.');
      await clearLocalReminders(session.userId);
      for (const reminder of reminderPlan(tickets, preferences, Date.now()))
        await Notifications.scheduleNotificationAsync({
          identifier: `tickey:${session.userId}:${reminder.sessionId}:${reminder.hours}`,
          content: {
            title: 'Nhắc lịch sự kiện',
            body: `${reminder.eventTitle} bắt đầu sau ${reminder.hours} giờ.`,
            data: { sessionId: reminder.sessionId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: new Date(reminder.at),
            channelId: 'events',
          },
        });
      return 'Đã cập nhật nhắc lịch trên thiết bị.';
    },
  });
}
