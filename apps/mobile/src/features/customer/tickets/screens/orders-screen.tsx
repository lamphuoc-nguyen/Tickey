import { formatMoney } from '@event/core';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, RefreshControl, View } from 'react-native';
import { Button, Copy, Heading, Icon, QueryState, Screen, ui } from '@/components/ui';
import { MenuRow } from '@/components/customer-controls';
import { TabBar } from '@/components/tab-bar';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useOrders } from '@/features/customer/account/hooks/use-customer-data';
import { bookingLabels } from '@/features/customer/booking/booking-presentation';

function Content() {
  const query = useOrders();
  const orders = query.data?.pages.flat() ?? [];
  const empty = !query.isPending && !query.error && !orders.length;
  return (
    <Screen
      back={false}
      footer={<TabBar current="/orders" />}
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
      }
    >
      <Heading>Đơn của tôi</Heading>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={empty}
        emptyText="Bạn chưa có đơn vé"
      />
      {empty && <Button onPress={() => router.replace('/')}>Khám phá sự kiện</Button>}
      {orders.map((order) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Đơn ${order.code}, ${order.session?.event?.title ?? ''}, ${bookingLabels[order.status]}`}
          onPress={() => router.push({ pathname: '/booking/[bookingId]', params: { bookingId: order.id } })}
          key={order.id}
          style={({ pressed }) => [ui.card, ui.row, pressed && { opacity: 0.8 }]}
        >
          {order.session?.event?.coverImageUrl && (
            <Image
              source={order.session.event.coverImageUrl}
              style={{ height: 68, width: 68, borderRadius: 10 }}
              contentFit="cover"
            />
          )}
          <View style={{ flex: 1, gap: 4 }}>
            <Copy style={ui.semibold}>{order.session?.event?.title ?? order.code}</Copy>
            <Copy style={ui.muted}>
              {order.code} · {order.itemCount} vé
            </Copy>
            <Copy>{formatMoney(order.totalAmount)}</Copy>
            <Copy style={[ui.muted, { fontSize: 12 }]}>{bookingLabels[order.status]}</Copy>
          </View>
          <View style={{ transform: [{ rotate: '-90deg' }] }} accessible={false}>
            <Icon name="chevron" />
          </View>
        </Pressable>
      ))}
      {query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()}>
          Xem thêm đơn
        </Button>
      )}
      <MenuRow
        icon="ticket"
        label="Vé của tôi"
        description="Vé điện tử và vé đã lưu"
        onPress={() => router.push('/tickets')}
      />
    </Screen>
  );
}
export default function OrdersScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
