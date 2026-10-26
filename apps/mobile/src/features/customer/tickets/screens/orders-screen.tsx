import { formatMoney } from '@event/core';
import { useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, RefreshControl, View } from 'react-native';
import { Button, Copy, Heading, Icon, QueryState, Screen, ui } from '@/components/ui';
import { MenuRow } from '@/components/customer-controls';
import { TabBar } from '@/components/tab-bar';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useOrders } from '@/features/customer/account/hooks/use-customer-data';
import { bookingLabels } from '@/features/customer/booking/booking-presentation';
import { BookingStatusBadge } from '@/features/customer/booking/components/booking-status';

function Content() {
  const query = useOrders();
  const [filter, setFilter] = useState('all');
  const orders = query.data?.pages.flat() ?? [];
  const visible = orders.filter(
    (order) =>
      filter === 'all' ||
      (filter === 'issued'
        ? order.status === 'CONFIRMED'
        : ['PENDING', 'PAYMENT_PENDING', 'PAID', 'REFUND_PENDING'].includes(order.status)),
  );
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
      <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
        {[
          { id: 'all', label: 'Tất cả' },
          { id: 'processing', label: 'Đang xử lý' },
          { id: 'issued', label: 'Đã phát hành' },
        ].map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === item.id }}
            onPress={() => setFilter(item.id)}
            style={{
              minHeight: 48,
              paddingHorizontal: 12,
              justifyContent: 'center',
              borderRadius: 12,
              backgroundColor: filter === item.id ? '#FFDAD3' : 'white',
              borderWidth: 1,
              borderColor: '#E7E4DF',
            }}
          >
            <Copy style={ui.semibold}>{item.label}</Copy>
          </Pressable>
        ))}
      </View>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={empty}
        emptyText="Bạn chưa có đơn vé"
      />
      {empty && <Button onPress={() => router.replace('/')}>Khám phá sự kiện</Button>}
      {!empty && !query.isPending && !query.error && !visible.length && (
        <Copy style={ui.muted}>
          {query.hasNextPage
            ? 'Chưa thấy đơn phù hợp. Tải thêm để xem các đơn trước.'
            : 'Chưa có đơn phù hợp.'}
        </Copy>
      )}
      {visible.map((order) => (
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
              {order.code} · {order.itemCount} chỗ
            </Copy>
            <Copy>{formatMoney(order.totalAmount)}</Copy>
            <BookingStatusBadge status={order.status} />
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
