import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { formatSessionTime } from '@event/core';
import { Button, Copy, Heading, Notice, QueryState, Screen, c, ui } from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useTickets } from '@/features/customer/account/hooks/use-customer-data';
import { useConnection, useSavedTickets } from '../hooks/use-ticket';
import { groupTicketsByBooking } from '../booking-pass';

function Content() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const query = useTickets();
  const saved = useSavedTickets();
  const online = useConnection();
  const [showSaved, setShowSaved] = useState(false);
  const offlineList = showSaved || !online;
  const records = (
    offlineList ? (saved.data?.map((t) => t.ticket) ?? []) : (query.data?.pages.flat() ?? [])
  ).filter((t) => !bookingId || t.bookingId === bookingId);
  const groups = groupTicketsByBooking(records);
  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={offlineList ? saved.isRefetching : query.isRefetching}
          onRefresh={() => void (offlineList ? saved.refetch() : query.refetch())}
        />
      }
    >
      <Heading>Vé của tôi</Heading>
      <View style={[ui.row, { gap: 4, backgroundColor: c.tint, padding: 4, borderRadius: 12 }]}>
        {[
          { label: 'Theo đơn', saved: false },
          { label: 'Đã lưu', saved: true },
        ].map((tab) => (
          <Pressable
            key={tab.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: offlineList === tab.saved, disabled: !online && !tab.saved }}
            disabled={!online && !tab.saved}
            onPress={() => setShowSaved(tab.saved)}
            style={{
              flex: 1,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              borderRadius: 8,
              backgroundColor: offlineList === tab.saved ? c.surface : 'transparent',
              opacity: !online && !tab.saved ? 0.5 : 1,
            }}
          >
            <Copy style={ui.semibold}>{tab.label}</Copy>
          </Pressable>
        ))}
      </View>
      {offlineList && (
        <Notice warning>Bản lưu trên thiết bị. Kết nối mạng để kiểm tra hiệu lực và lượt vào cổng.</Notice>
      )}
      <QueryState
        loading={offlineList ? saved.isPending : query.isPending}
        error={offlineList ? saved.error : query.error}
        retry={() => void (offlineList ? saved.refetch() : query.refetch())}
        empty={
          offlineList
            ? !saved.isPending && !saved.error && !groups.length
            : !query.isPending && !query.error && !groups.length
        }
        emptyText={offlineList ? 'Bạn chưa lưu vé.' : 'Bạn chưa có vé trong danh sách đã tải.'}
      />
      {groups.map((group) => {
        const first = group.tickets[0]!;
        return (
          <Pressable
            key={group.bookingId}
            accessibilityRole="button"
            accessibilityLabel={`Xem đơn vé ${first.session?.event?.title ?? ''}`}
            onPress={() =>
              router.push(
                offlineList
                  ? { pathname: '/tickets/offline', params: { bookingId: group.bookingId } }
                  : { pathname: '/booking/[bookingId]/result', params: { bookingId: group.bookingId } },
              )
            }
            style={[ui.card, { gap: 8 }]}
          >
            <Copy style={ui.semibold}>{first.session?.event?.title ?? 'Vé của đơn'}</Copy>
            {first.session && (
              <Copy style={ui.muted}>
                {formatSessionTime(first.session.startsAt, first.session.venue?.timezone)}
              </Copy>
            )}
            <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
              <Copy style={ui.muted}>{group.tickets.length} chỗ đã tải</Copy>
              <Copy style={{ color: c.primary }}>Xem vé của đơn</Copy>
            </View>
          </Pressable>
        );
      })}
      {!offlineList && query.hasNextPage && (
        <Button secondary busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()}>
          Xem thêm đơn vé
        </Button>
      )}
    </Screen>
  );
}
export default function TicketsScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
