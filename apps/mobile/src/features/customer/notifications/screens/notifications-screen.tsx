import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { Button, Card, Copy, ErrorNotice, Heading, QueryState, Screen, c, ui } from '@/components/ui';
import { TextAction } from '@/components/customer-controls';
import { TabBar } from '@/components/tab-bar';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useAccountActions, useNotifications } from '@/features/customer/account/hooks/use-customer-data';
import { notificationDestination } from '../notification-destination';
import { notificationDay, notificationTime } from '../notification-presentation';
function Content() {
  const query = useNotifications();
  const { markRead } = useAccountActions();
  const notifications = query.data?.pages.flat() ?? [];
  return (
    <Screen
      back={false}
      bottomNavigation={<TabBar current="/notifications" />}
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
      {notifications.map((notification, index) => {
        const destination = notificationDestination(notification.data);
        const navigable = destination.kind !== 'notifications';
        const day = notificationDay(notification.createdAt);
        const contents = (
          <>
            <View style={[ui.row, { alignItems: 'flex-start', gap: 8 }]}>
              {!notification.readAt && (
                <View
                  accessible={false}
                  style={{ width: 8, height: 8, marginTop: 6, borderRadius: 4, backgroundColor: c.primary }}
                />
              )}
              <Copy style={[ui.semibold, { flex: 1, minWidth: 0 }]}>
                {notification.title ?? 'Thông báo Tickey'}
              </Copy>
            </View>
            {!!notification.body && <Copy style={ui.muted}>{notification.body}</Copy>}
            <Copy style={[ui.muted, { fontSize: 12 }]}>{notificationTime(notification.createdAt)}</Copy>
          </>
        );
        return (
          <Fragment key={notification.id}>
            {(index === 0 || notificationDay(notifications[index - 1]!.createdAt) !== day) && (
              <Heading small>{day}</Heading>
            )}
            {navigable ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${notification.title ?? 'Thông báo'}${notification.readAt ? '' : ', chưa đọc'}`}
                accessibilityHint={destination.kind === 'booking' ? 'Mở đơn liên quan' : 'Mở vé liên quan'}
                style={({ pressed }) => [
                  ui.card,
                  !notification.readAt && { borderColor: c.primary },
                  pressed && { backgroundColor: c.tint },
                ]}
                onPress={() => {
                  if (!notification.readAt && !markRead.isPending) markRead.mutate([notification.id]);
                  if (destination.kind === 'ticket')
                    router.push({ pathname: '/tickets/[ticketId]', params: { ticketId: destination.id } });
                  else if (destination.kind === 'booking')
                    router.push({ pathname: '/booking/[bookingId]', params: { bookingId: destination.id } });
                  else router.push('/tickets');
                }}
              >
                {contents}
              </Pressable>
            ) : (
              <Card>
                {contents}
                {!notification.readAt && (
                  <TextAction busy={markRead.isPending} onPress={() => markRead.mutate([notification.id])}>
                    Đánh dấu đã đọc
                  </TextAction>
                )}
              </Card>
            )}
          </Fragment>
        );
      })}
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
