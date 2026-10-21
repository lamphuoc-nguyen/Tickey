import { useLocalSearchParams, router } from 'expo-router';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { Button, ErrorNotice, Notice, QueryState, Screen } from '@/components/ui';
import { MenuGroup, MenuRow } from '@/components/customer-controls';
import { useBookingTickets, useTicket } from '../hooks/use-ticket';
import { TicketPresentation } from '../components/ticket-presentation';
function Content() {
  const { ticketId = '' } = useLocalSearchParams<{ ticketId: string }>();
  const { ticket, online, query, download, downloadedAt, saved } = useTicket(ticketId);
  const siblings = useBookingTickets(online ? (ticket?.bookingId ?? '') : '');
  const list = online
    ? (siblings.data ?? [])
    : (saved.data?.map((s) => s.ticket).filter((t) => t.bookingId === ticket?.bookingId) ?? []);
  const position = list.findIndex((t) => t.id === ticketId),
    next = position >= 0 ? list[position + 1] : undefined;
  return (
    <Screen
      footer={
        <Button
          disabled={!ticket}
          disabledReason="Cần tải được vé trước khi mở đơn hoặc vé tiếp theo."
          onPress={() => {
            if (!ticket) return;
            if (next) router.replace({ pathname: '/tickets/[ticketId]', params: { ticketId: next.id } });
            else router.push({ pathname: '/booking/[bookingId]', params: { bookingId: ticket.bookingId } });
          }}
        >
          {next ? 'Vé tiếp theo' : 'Về đơn của tôi'}
        </Button>
      }
    >
      <QueryState
        loading={online ? query.isPending : saved.isPending}
        error={online ? query.error : saved.error}
        retry={() => void (online ? query.refetch() : saved.refetch())}
        empty={!online && !saved.isPending && !saved.error && !ticket}
        emptyText="Vé này chưa được tải để xem offline."
      />
      <TicketPresentation
        ticket={ticket}
        online={online}
        downloadedAt={downloadedAt}
        stale={online && !!query.error}
        position={position}
        count={list.length}
      />
      {ticket?.session?.status === 'CANCELLED' && (
        <>
          <Notice warning>Suất diễn đã bị hủy. Vé không dùng để vào cổng.</Notice>
          <MenuRow
            label="Thông tin hủy suất và hoàn tiền"
            onPress={() => router.push({ pathname: '/tickets/[ticketId]/cancelled', params: { ticketId } })}
          />
        </>
      )}
      <QueryState error={siblings.error} retry={() => void siblings.refetch()} compact />
      <MenuGroup title="Thông tin vé">
        <MenuRow
          icon="venue"
          label="Địa điểm tổ chức"
          disabled={!ticket}
          disabledReason="Cần tải được vé để xác định địa điểm."
          onPress={() => router.push({ pathname: '/tickets/[ticketId]/venue', params: { ticketId } })}
        />
        {ticket && !ticket.holderName && ticket.status === 'ISSUED' && online && (
          <MenuRow
            icon="account"
            label="Ghi tên người tham dự"
            disabled={!!query.error}
            disabledReason="Cần kiểm tra được trạng thái vé trước khi ghi tên."
            onPress={() => router.push({ pathname: '/tickets/[ticketId]/holder', params: { ticketId } })}
          />
        )}
        <MenuRow
          icon="ticket"
          navigation={false}
          label={download.isSuccess ? 'Đã lưu vé trên thiết bị' : 'Lưu vé để xem offline'}
          busy={download.isPending}
          disabled={!online || !query.data || !!query.error}
          disabledReason={
            !online
              ? 'Cần kết nối mạng để tải bản cập nhật của vé.'
              : 'Cần tải được thông tin vé trước khi lưu để xem offline.'
          }
          onPress={() => download.mutate()}
        />
        {online && (
          <MenuRow
            navigation={false}
            label="Cập nhật trạng thái vé"
            busy={query.isRefetching}
            onPress={() => void query.refetch()}
          />
        )}
      </MenuGroup>
      {!!download.error && <ErrorNotice error={download.error} />}
      <MenuGroup title="Hỗ trợ">
        <MenuRow
          label="Gửi phản ánh"
          disabled={!ticket}
          disabledReason="Cần tải được vé liên quan trước khi gửi phản ánh."
          onPress={() => router.push({ pathname: '/reports/new', params: { ticketId } })}
        />
        <MenuRow
          label="Liên hệ hỗ trợ"
          onPress={() =>
            router.push(
              ticket ? { pathname: '/support', params: { bookingId: ticket.bookingId } } : '/support',
            )
          }
        />
      </MenuGroup>
    </Screen>
  );
}
export default function TicketScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
