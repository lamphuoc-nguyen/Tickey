import { router } from 'expo-router';
import { Pressable, RefreshControl } from 'react-native';
import { Button, Copy, ErrorNotice, Heading, QueryState, Screen, ui } from '@/components/ui';
import { TabBar } from '@/components/tab-bar';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useAccountActions, useNotifications } from '@/features/account/hooks/use-customer-data';
import { notificationDestination } from '../notification-destination';
function Content() {
  const query = useNotifications();
  const { markRead } = useAccountActions();
  const notifications = query.data?.pages.flat() ?? [];
  return (
    <Screen
      back={false}
      footer={<TabBar current="/notifications" />}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
      }
    >
      <Heading>Thông báo</Heading>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !notifications.length}
        emptyText="Bạn chưa có thông báo."
      />
      {notifications.map((notification) => (
        <Pressable
          key={notification.id}
          accessibilityRole="button"
          accessibilityLabel={`${notification.title ?? 'Thông báo'}${notification.readAt ? '' : ', chưa đọc'}`}
          style={ui.card}
          onPress={() => {
            if (!notification.readAt && !markRead.isPending) markRead.mutate([notification.id]);
            const destination = notificationDestination(notification.data);
            if (destination.kind === 'ticket')
              router.push({ pathname: '/tickets/[ticketId]', params: { ticketId: destination.id } });
            else if (destination.kind === 'booking')
              router.push({ pathname: '/booking/[bookingId]', params: { bookingId: destination.id } });
            else if (destination.kind === 'tickets') router.push('/tickets');
          }}
        >
          <Copy style={ui.semibold}>
            {notification.readAt ? '' : '• '}
            {notification.title ?? 'Thông báo Tickey'}
          </Copy>
          <Copy>{notification.body}</Copy>
          <Copy style={ui.muted}>{new Date(notification.createdAt).toLocaleString('vi-VN')}</Copy>
        </Pressable>
      ))}
      {!!markRead.error && <ErrorNotice error={markRead.error} />}
      <Button secondary onPress={() => router.push('/tickets')}>
        Mở vé của tôi
      </Button>
      {query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()}>
          Xem thêm thông báo
        </Button>
      )}
    </Screen>
  );
}
export default function NotificationsScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
