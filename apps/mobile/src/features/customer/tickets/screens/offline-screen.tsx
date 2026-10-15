import { ticketStatusLabels } from '../ticket-status';
import { useState } from 'react';
import { formatSessionTime } from '@event/core';
import { Button, Card, Copy, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { useOfflineTickets } from '../hooks/use-ticket';
import { TicketPresentation } from '../components/ticket-presentation';

/** Local downloads remain viewable if a refresh token cannot be renewed offline. No authenticated writes here. */
export default function OfflineScreen() {
  const query = useOfflineTickets();
  const [id, setId] = useState<string | null>(null);
  const selected = query.data?.find((entry) => entry.ticket.id === id);
  return (
    <Screen>
      <Heading>Vé đã tải</Heading>
      <Notice warning>
        Đang xem dữ liệu lưu trên thiết bị. Thời điểm cập nhật không chứng minh vé còn hiệu lực; kết nối mạng
        để kiểm tra với máy chủ.
      </Notice>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !query.data?.length}
        emptyText="Chưa có vé đã tải."
      />
      {query.data?.map((entry) => (
        <Card key={entry.ticket.id}>
          <Copy>
            {entry.ticket.session?.event?.title ?? 'Vé Tickey'} · {entry.ticket.seat?.seatCode ?? 'Khu đứng'}
          </Copy>
          <Copy>Trạng thái lưu: {ticketStatusLabels[entry.ticket.status]}</Copy>
          <Copy>Tải lúc: {formatSessionTime(entry.downloadedAt)}</Copy>
          <Button secondary onPress={() => setId(entry.ticket.id)}>
            Xem vé đã tải
          </Button>
        </Card>
      ))}
      {selected && (
        <Card>
          <TicketPresentation ticket={selected.ticket} online={false} downloadedAt={selected.downloadedAt} />
          <Button secondary onPress={() => setId(null)}>
            Đóng vé đã tải
          </Button>
        </Card>
      )}
    </Screen>
  );
}
