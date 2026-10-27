import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { formatMoney, formatSessionTime } from '@event/core';
import { Button, Copy, Heading, Icon, Notice, QueryState, Screen, c, ui } from '@/components/ui';
import { TabBar } from '@/components/tab-bar';
import { TextAction } from '@/components/customer-controls';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useOrders } from '@/features/customer/account/hooks/use-customer-data';
import { BookingStatusBadge } from '@/features/customer/booking/components/booking-status';
import { useConnection, useSavedTickets } from '../hooks/use-ticket';
import { groupTicketsByBooking } from '../booking-pass';
import { orderHasTickets, orderInView, orderView, type OrderView } from '../order-presentation';

function Content({ initialView, bookingId }: { initialView: OrderView; bookingId?: string }) {
  const orders = useOrders();
  const saved = useSavedTickets();
  const online = useConnection();
  const [view, setView] = useState(initialView);
  const current = online ? view : 'saved';
  const offlineList = current === 'saved';
  const loaded = (orders.data?.pages.flat() ?? []).filter((order) => !bookingId || order.id === bookingId);
  const visible = loaded.filter((order) => orderInView(order, current));
  const savedGroups = groupTicketsByBooking(
    (saved.data ?? [])
      .map((entry) => entry.ticket)
      .filter((ticket) => !bookingId || ticket.bookingId === bookingId),
  );
  const loading = offlineList ? saved.isPending : orders.isPending;
  const error = offlineList ? saved.error : orders.error;
  const empty = !loading && !error && (offlineList ? !savedGroups.length : !visible.length);
  const more = !offlineList && orders.hasNextPage;
  return (
    <Screen
      back={false}
      footer={<TabBar current="/orders" />}
      refreshControl={
        <RefreshControl
          refreshing={offlineList ? saved.isRefetching : orders.isRefetching}
          onRefresh={() => void (offlineList ? saved.refetch() : orders.refetch())}
        />
      }
    >
      <Heading>{bookingId ? 'Vé của đơn' : 'Vé của tôi'}</Heading>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {(
          [
            { id: 'tickets', label: 'Vé đã mua' },
            { id: 'processing', label: 'Đang xử lý' },
            { id: 'all', label: 'Tất cả đơn' },
            { id: 'saved', label: 'Đã lưu' },
          ] as const
        ).map((tab) => (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: current === tab.id, disabled: !online && tab.id !== 'saved' }}
            disabled={!online && tab.id !== 'saved'}
            onPress={() => setView(tab.id)}
            style={{
              minHeight: 48,
              paddingHorizontal: 16,
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: current === tab.id ? c.primaryContainer : c.surface,
              opacity: !online && tab.id !== 'saved' ? 0.5 : 1,
            }}
          >
            <Copy style={current === tab.id ? ui.semibold : ui.muted}>{tab.label}</Copy>
          </Pressable>
        ))}
      </ScrollView>
      {offlineList && (
        <Notice warning>
          {online ? 'Thông tin đã lưu trên thiết bị.' : 'Bạn đang offline. Chỉ hiển thị vé đã lưu.'} Kết nối
          mạng để kiểm tra hiệu lực vé.
        </Notice>
      )}
      <QueryState
        loading={loading}
        error={error}
        retry={() => void (offlineList ? saved.refetch() : orders.refetch())}
        empty={empty}
        emptyText={
          offlineList
            ? 'Bạn chưa lưu vé trên thiết bị.'
            : more
              ? 'Chưa thấy đơn phù hợp trong danh sách đã tải.'
              : current === 'tickets'
                ? 'Bạn chưa có vé đã phát hành.'
                : current === 'processing'
                  ? 'Không có đơn đang xử lý.'
                  : 'Bạn chưa có đơn vé.'
        }
      />
      {empty && current === 'tickets' && loaded.some((order) => orderInView(order, 'processing')) && (
        <Button onPress={() => setView('processing')}>Xem đơn đang xử lý</Button>
      )}
      {empty && !offlineList && !more && !bookingId && (
        <TextAction onPress={() => router.replace('/')}>Khám phá sự kiện</TextAction>
      )}
      {!offlineList &&
        visible.map((order) => (
          <Pressable
            key={order.id}
            accessibilityRole="button"
            accessibilityLabel={`${orderHasTickets(order) ? 'Xem vé' : 'Xem đơn'} ${order.session?.event?.title ?? order.code}`}
            onPress={() =>
              router.push({
                pathname: orderHasTickets(order) ? '/booking/[bookingId]/result' : '/booking/[bookingId]',
                params: { bookingId: order.id },
              })
            }
            style={({ pressed }) => [ui.card, { gap: 12 }, pressed && { opacity: 0.8 }]}
          >
            <View style={[ui.row, { alignItems: 'flex-start' }]}>
              {order.session?.event?.coverImageUrl && (
                <Image
                  source={order.session.event.coverImageUrl}
                  style={{ width: 72, height: 88, borderRadius: 10 }}
                  contentFit="cover"
                />
              )}
              <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                <Copy numberOfLines={2} style={ui.semibold}>
                  {order.session?.event?.title ?? 'Đơn vé'}
                </Copy>
                {order.session?.startsAt && (
                  <Copy style={[ui.muted, { fontSize: 12 }]}>
                    {formatSessionTime(order.session.startsAt)}
                  </Copy>
                )}
                <Copy style={ui.muted}>
                  {order.itemCount} chỗ · {formatMoney(order.totalAmount)}
                </Copy>
                <BookingStatusBadge status={order.status} />
              </View>
            </View>
            <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
              <Copy style={[ui.muted, { fontSize: 12 }]}>{order.code}</Copy>
              <Copy style={[ui.semibold, { color: c.primary }]}>
                {orderHasTickets(order) ? 'Xem vé →' : 'Xem đơn →'}
              </Copy>
            </View>
          </Pressable>
        ))}
      {offlineList &&
        savedGroups.map((group) => {
          const first = group.tickets[0]!;
          return (
            <Pressable
              key={group.bookingId}
              accessibilityRole="button"
              accessibilityLabel={`Xem vé đã lưu ${first.session?.event?.title ?? ''}`}
              onPress={() =>
                router.push({ pathname: '/tickets/offline', params: { bookingId: group.bookingId } })
              }
              style={[ui.card, { gap: 8 }]}
            >
              <View style={[ui.row, { justifyContent: 'space-between' }]}>
                <Copy style={[ui.semibold, { flex: 1 }]}>{first.session?.event?.title ?? 'Vé của đơn'}</Copy>
                <Icon name="ticket" />
              </View>
              {first.session && (
                <Copy style={ui.muted}>
                  {formatSessionTime(first.session.startsAt, first.session.venue?.timezone)}
                </Copy>
              )}
              <Copy style={ui.muted}>{group.tickets.length} chỗ đã lưu</Copy>
              <Copy style={{ color: c.primary }}>Xem bản lưu →</Copy>
            </Pressable>
          );
        })}
      {more && (
        <Button secondary busy={orders.isFetchingNextPage} onPress={() => void orders.fetchNextPage()}>
          Tải thêm đơn
        </Button>
      )}
    </Screen>
  );
}

export default function TicketHubScreen() {
  const params = useLocalSearchParams<{ view?: string; bookingId?: string }>();
  const view = orderView(typeof params.view === 'string' ? params.view : undefined);
  const bookingId = typeof params.bookingId === 'string' ? params.bookingId : undefined;
  return (
    <AuthGate>
      <Content key={`${view}:${bookingId ?? 'all'}`} initialView={view} bookingId={bookingId} />
    </AuthGate>
  );
}
