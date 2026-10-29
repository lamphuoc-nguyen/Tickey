import { useLocalSearchParams, router } from 'expo-router';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { ActionFooter, ErrorNotice, Heading, QueryState, Screen } from '@/components/ui';
import { MenuGroup, MenuRow } from '@/components/customer-controls';
import { BuyerInfo } from '@/features/customer/booking/components/buyer-info';
import { useBookingTickets, useOrder, useSaveBookingTickets, useTicket } from '../hooks/use-ticket';
import { BookingPassPresentation } from '../components/booking-pass-presentation';
import { oldestDownload } from '../booking-pass';

/** Existing ticket links resolve to their booking; no per-person carousel or name assignment. */
function Content() {
  const { ticketId = '' } = useLocalSearchParams<{ ticketId: string }>();
  const { ticket, online, query, saved } = useTicket(ticketId);
  const bookingId = ticket?.bookingId ?? '';
  const siblings = useBookingTickets(bookingId, online);
  const order = useOrder(bookingId, online);
  const save = useSaveBookingTickets();
  const records = online
    ? (siblings.data ?? (ticket ? [ticket] : []))
    : (saved.data?.filter((s) => s.ticket.bookingId === bookingId).map((s) => s.ticket) ?? []);
  const canSave = online && !!siblings.data?.length && !query.error && !siblings.error && !order.error;
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={!ticket}
          disabledReason="Cần tải được thông tin đơn trước khi tiếp tục."
          onPress={() =>
            ticket &&
            router.push(
              online ? { pathname: '/booking/[bookingId]', params: { bookingId } } : '/tickets/offline',
            )
          }
        >
          {online ? 'Chi tiết đơn' : 'Vé đã tải'}
        </ActionFooter>
      }
    >
      <Heading>Vé vào cổng</Heading>
      <QueryState
        loading={online ? query.isPending : saved.isPending}
        error={online ? query.error : saved.error}
        retry={() => void (online ? query.refetch() : saved.refetch())}
        empty={!online && !saved.isPending && !saved.error && !ticket}
        emptyText="Đơn này chưa được tải để xem offline."
      />
      {ticket && (
        <>
          {online && (
            <QueryState
              loading={siblings.isPending}
              error={siblings.error ?? order.error}
              retry={() => {
                void siblings.refetch();
                void order.refetch();
              }}
              compact
            />
          )}
          <BookingPassPresentation
            order={order.data}
            tickets={records}
            online={online}
            downloadedAt={oldestDownload(saved.data ?? [], bookingId)}
            stale={online && (!!query.error || !!siblings.error || !!order.error)}
          />
          <BuyerInfo online={online} />
          <MenuGroup title="Thông tin và hỗ trợ">
            {ticket.session?.status === 'CANCELLED' && (
              <MenuRow
                label="Suất hủy và hoàn tiền"
                onPress={() =>
                  router.push({ pathname: '/tickets/[ticketId]/cancelled', params: { ticketId } })
                }
              />
            )}
            {online && (
              <MenuRow
                navigation={false}
                label="Cập nhật thông tin vé"
                busy={query.isRefetching || siblings.isRefetching || order.isRefetching}
                onPress={() => {
                  void query.refetch();
                  void siblings.refetch();
                  void order.refetch();
                }}
              />
            )}
            <MenuRow
              icon="venue"
              label="Địa điểm tổ chức"
              onPress={() => router.push({ pathname: '/tickets/[ticketId]/venue', params: { ticketId } })}
            />
            <MenuRow
              icon="ticket"
              navigation={false}
              label={save.isSuccess ? 'Đã lưu thông tin vé trên thiết bị' : 'Lưu đơn để xem offline'}
              busy={save.isPending}
              disabled={!canSave}
              disabledReason={
                online
                  ? 'Cần tải đủ thông tin vé của đơn trước khi lưu.'
                  : 'Kết nối mạng để tải thông tin mới nhất.'
              }
              onPress={() => save.mutate(siblings.data ?? [])}
            />
            <MenuRow
              label="Gửi phản ánh"
              onPress={() => router.push({ pathname: '/reports/new', params: { ticketId } })}
            />
            <MenuRow
              label="Liên hệ hỗ trợ"
              onPress={() => router.push({ pathname: '/support/new', params: { bookingId } })}
            />
          </MenuGroup>
          {!!save.error && <ErrorNotice error={save.error} />}
        </>
      )}
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
