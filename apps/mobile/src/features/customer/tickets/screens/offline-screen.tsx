import { ticketStatusLabels } from '../ticket-status';
import { useState } from 'react';
import { router } from 'expo-router';
import { formatSessionTime } from '@event/core';
import { Button, Card, Copy, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { useConnection, useOfflineTickets } from '../hooks/use-ticket';
import { TicketPresentation } from '../components/ticket-presentation';
import { TextAction } from '@/components/customer-controls';

/** Local downloads remain viewable if a refresh token cannot be renewed offline. No authenticated writes here. */
export default function OfflineScreen() {
  const query = useOfflineTickets();
  const online = useConnection();
  const [id, setId] = useState<string | null>(null);
  return (
    <Screen>
      <Heading>Vé đã tải</Heading>
      <Notice warning>Bản lưu trên thiết bị. Kết nối mạng để kiểm tra hiệu lực vé.</Notice>
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
          <TextAction
            expanded={id === entry.ticket.id}
            accessibilityLabel={`${id === entry.ticket.id ? 'Đóng' : 'Xem'} vé ${entry.ticket.seat?.seatCode ?? entry.ticket.id}`}
            onPress={() => setId((current) => (current === entry.ticket.id ? null : entry.ticket.id))}
          >
            {id === entry.ticket.id ? 'Đóng vé đã tải' : 'Xem vé đã tải'}
          </TextAction>
          {id === entry.ticket.id && (
            <TicketPresentation ticket={entry.ticket} online={false} downloadedAt={entry.downloadedAt} />
          )}
        </Card>
      ))}
      {online && (
        <Button secondary onPress={() => router.replace('/tickets')}>
          Kiểm tra vé với máy chủ
        </Button>
      )}
    </Screen>
  );
}
