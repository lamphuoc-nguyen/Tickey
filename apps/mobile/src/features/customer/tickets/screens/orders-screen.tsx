import { formatMoney } from '@event/core';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, RefreshControl, View } from 'react-native';
import { ActionFooter, Button, Copy, Heading, QueryState, Screen, ui } from '@/components/ui';
import { TabBar } from '@/components/tab-bar';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useOrders } from '@/features/customer/account/hooks/use-customer-data';
import { bookingLabels } from '@/features/customer/booking/booking-presentation';
import { useFormDraft } from '@/features/forms/use-form-draft';

function Content() {
  const query = useOrders();
  const orders = query.data?.pages.flat() ?? [];
  const { draft, update } = useFormDraft('orders:selection', { id: '' });
  const selected = orders.find((order) => order.id === draft.id);
  const empty = !query.isPending && !query.error && !orders.length;
  return (
    <Screen
      back={false}
      footer={
        empty ? (
          <ActionFooter onPress={() => router.replace('/')}>Khám phá sự kiện</ActionFooter>
        ) : (
          <View style={{ gap: 16 }}>
            {!!orders.length && (
              <Button
                disabled={!selected}
                disabledReason="Chọn một đơn trong danh sách để xem chi tiết."
                onPress={() => {
                  if (selected)
                    router.push({ pathname: '/booking/[bookingId]', params: { bookingId: selected.id } });
                }}
              >
                {selected ? `Xem đơn ${selected.code}` : 'Xem đơn đã chọn'}
              </Button>
            )}
            <TabBar current="/orders" />
          </View>
        )
      }
      refreshControl={
        <RefreshControl refreshing={query.isRefetching} onRefresh={() => void query.refetch()} />
      }
    >
      <Heading>{empty ? 'Bạn chưa có đơn vé' : 'Đơn của tôi'}</Heading>
      {empty && <Copy style={ui.muted}>Vé của bạn sẽ xuất hiện ở đây sau khi đặt.</Copy>}
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={empty}
        emptyText="Khám phá sự kiện và chọn vé phù hợp với bạn."
      />
      {orders.map((order) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: order.id === selected?.id }}
          accessibilityLabel={`Đơn ${order.code}`}
          onPress={() => update({ id: order.id })}
          key={order.id}
          style={[ui.card, { padding: 8 }, order.id === selected?.id && { borderColor: '#B93620' }]}
        >
          {order.session?.event?.coverImageUrl && (
            <Image
              source={order.session.event.coverImageUrl}
              style={{ height: 68, width: '100%', borderRadius: 10 }}
              contentFit="cover"
            />
          )}
          <Copy style={ui.semibold}>
            {order.code} · {order.session?.event?.title}
          </Copy>
          <Copy style={[ui.muted, { fontSize: 11 }]}>
            {order.itemCount} vé · {formatMoney(order.totalAmount)} · {bookingLabels[order.status]}
          </Copy>
        </Pressable>
      ))}
      {query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()}>
          Xem thêm đơn
        </Button>
      )}
      <Button secondary onPress={() => router.push('/tickets')}>
        Danh sách vé · Vé đã tải
      </Button>
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
