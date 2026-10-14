import { ticketStatusLabels } from '../ticket-status';
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable } from 'react-native';
import { Button, Copy, Heading, Notice, QueryState, Screen, ui } from '@/components/ui';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useTickets } from '@/features/account/hooks/use-customer-data';
import { useConnection, useSavedTickets } from '../hooks/use-ticket';

function Content() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const query = useTickets();
  const saved = useSavedTickets();
  const online = useConnection();
  const [showSaved, setShowSaved] = useState(false);
  const offlineList = showSaved || !online;
  const list = (
    offlineList ? (saved.data?.map((t) => t.ticket) ?? []) : (query.data?.pages.flat() ?? [])
  ).filter((ticket) => !bookingId || ticket.bookingId === bookingId);
  return (
    <Screen>
      <Heading>{offlineList ? 'Vé đã tải' : 'Vé của tôi'}</Heading>
      <Button secondary onPress={() => setShowSaved((p) => !p)}>
        {showSaved ? 'Xem vé từ máy chủ' : 'Xem vé đã tải'}
      </Button>
      {offlineList && (
        <Notice warning>
          Vé đã lưu hiển thị trạng thái ở lần cập nhật trước. Kết nối mạng để xác nhận trạng thái hiện tại.
        </Notice>
      )}
      <QueryState
        loading={offlineList ? saved.isPending : query.isPending}
        error={offlineList ? saved.error : query.error}
        retry={() => void (offlineList ? saved.refetch() : query.refetch())}
        empty={
          offlineList
            ? !saved.isPending && !saved.error && !list.length
            : !query.isPending && !query.error && !list.length
        }
        emptyText={offlineList ? 'Bạn chưa tải vé phù hợp.' : 'Chưa có vé phù hợp trong các trang đã tải.'}
      />
      {list.map((ticket) => (
        <Pressable
          key={ticket.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/tickets/[ticketId]', params: { ticketId: ticket.id } })}
          style={ui.card}
        >
          <Copy style={ui.semibold}>{ticket.session?.event?.title}</Copy>
          <Copy>
            {ticket.seat?.seatCode ?? 'Khu đứng'} · {ticket.ticketType?.name}
          </Copy>
          <Copy style={ui.muted}>Trạng thái gần nhất: {ticketStatusLabels[ticket.status]}</Copy>
        </Pressable>
      ))}
      {!offlineList && query.hasNextPage && (
        <Button busy={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()}>
          Xem thêm vé
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
