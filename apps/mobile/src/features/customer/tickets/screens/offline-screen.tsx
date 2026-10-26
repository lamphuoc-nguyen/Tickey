import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Button, Card, Copy, Heading, Notice, QueryState, Screen, ui } from '@/components/ui';
import { TextAction } from '@/components/customer-controls';
import { BuyerInfo } from '@/features/customer/booking/components/buyer-info';
import { useConnection, useOfflineTickets } from '../hooks/use-ticket';
import { BookingPassPresentation } from '../components/booking-pass-presentation';
import { groupTicketsByBooking, oldestDownload } from '../booking-pass';

/** Existing offline access/account guards are unchanged; snapshots are grouped only for display. */
function OfflineContent({ bookingId }: { bookingId?: string }) {
  const query = useOfflineTickets();
  const online = useConnection();
  const [id, setId] = useState<string | null>(bookingId ?? null);
  const groups = groupTicketsByBooking(query.data?.map((entry) => entry.ticket) ?? []);
  return (
    <Screen>
      <Heading>Vé đã tải</Heading>
      {!groups.some((group) => group.bookingId === id) && (
        <Notice warning>Bản lưu trên thiết bị. Kết nối mạng để kiểm tra hiệu lực và lượt vào cổng.</Notice>
      )}
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !groups.length}
        emptyText="Chưa có đơn vé đã tải."
      />
      {groups.map((group) => (
        <Card key={group.bookingId}>
          <Copy style={ui.semibold}>{group.tickets[0]?.session?.event?.title ?? 'Vé của đơn'}</Copy>
          <Copy style={ui.muted}>{group.tickets.length} chỗ đã lưu</Copy>
          <TextAction
            expanded={id === group.bookingId}
            onPress={() => setId((current) => (current === group.bookingId ? null : group.bookingId))}
          >
            {id === group.bookingId ? 'Thu gọn vé của đơn' : 'Xem vé của đơn'}
          </TextAction>
          {id === group.bookingId && (
            <>
              <BookingPassPresentation
                tickets={group.tickets}
                online={false}
                downloadedAt={oldestDownload(query.data ?? [], group.bookingId)}
              />
              <BuyerInfo online={false} />
            </>
          )}
        </Card>
      ))}
      {online && (
        <Button secondary onPress={() => router.replace('/tickets')}>
          Cập nhật vé từ máy chủ
        </Button>
      )}
    </Screen>
  );
}

export default function OfflineScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId?: string }>();
  const selected = typeof bookingId === 'string' ? bookingId : undefined;
  return <OfflineContent key={selected ?? 'all'} bookingId={selected} />;
}
