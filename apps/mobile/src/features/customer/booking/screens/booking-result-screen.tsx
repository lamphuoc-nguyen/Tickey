import { router, useLocalSearchParams } from 'expo-router';
import { ActionFooter, ErrorNotice, Heading, QueryState, Screen } from '@/components/ui';
import { Disclosure, MenuGroup, MenuRow } from '@/components/customer-controls';
import { DetailRow, UnavailableAction } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import {
  useBookingTickets,
  useOrder,
  useSaveBookingTickets,
} from '@/features/customer/tickets/hooks/use-ticket';
import { BookingPassPresentation } from '@/features/customer/tickets/components/booking-pass-presentation';
import { useBooking } from '../hooks/use-booking';
import { BuyerInfo } from '../components/buyer-info';

function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
  const order = useOrder(bookingId);
  const booking = query.data;
  const issued =
    !!booking && ['CONFIRMED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(booking.status);
  const tickets = useBookingTickets(bookingId, issued);
  const save = useSaveBookingTickets();
  const firstTicket = tickets.data?.[0];
  const cancelledTicket = tickets.data?.find((ticket) => ticket.session?.status === 'CANCELLED');
  const canSave = issued && !!tickets.data?.length && !tickets.error && !query.error && !order.error;
  return (
    <Screen
      footer={
        <ActionFooter
          busy={query.isRefetching}
          onPress={() =>
            issued
              ? router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } })
              : void query.refetch()
          }
        >
          {issued ? 'Chi tiết đơn' : 'Kiểm tra trạng thái'}
        </ActionFooter>
      }
    >
      <Heading>Vé vào cổng</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {booking && (
        <>
          <QueryState error={order.error} retry={() => void order.refetch()} compact />
          {issued && (
            <QueryState
              loading={tickets.isPending}
              error={tickets.error}
              retry={() => void tickets.refetch()}
              empty={!tickets.isPending && !tickets.error && !tickets.data?.length}
              emptyText="Chưa tải được thông tin các chỗ trong đơn."
              compact
            />
          )}
          <BookingPassPresentation
            booking={booking}
            order={order.data}
            tickets={tickets.data ?? []}
            online
            stale={!!query.error || !!order.error || !!tickets.error}
          />
          <BuyerInfo />
          <MenuGroup title="Thông tin đơn">
            {firstTicket && (
              <MenuRow
                icon="venue"
                label="Địa điểm tổ chức"
                onPress={() =>
                  router.push({ pathname: '/tickets/[ticketId]/venue', params: { ticketId: firstTicket.id } })
                }
              />
            )}
            {cancelledTicket && (
              <MenuRow
                label="Suất hủy và hoàn tiền"
                onPress={() =>
                  router.push({
                    pathname: '/tickets/[ticketId]/cancelled',
                    params: { ticketId: cancelledTicket.id },
                  })
                }
              />
            )}
            {firstTicket && (
              <MenuRow
                label="Gửi phản ánh"
                onPress={() =>
                  router.push({ pathname: '/reports/new', params: { ticketId: firstTicket.id } })
                }
              />
            )}
            <MenuRow
              navigation={false}
              label="Cập nhật thông tin vé"
              busy={query.isRefetching || tickets.isRefetching || order.isRefetching}
              onPress={() => {
                void query.refetch();
                void order.refetch();
                if (issued) void tickets.refetch();
              }}
            />
            <MenuRow
              icon="ticket"
              navigation={false}
              label={save.isSuccess ? 'Đã lưu thông tin vé trên thiết bị' : 'Lưu đơn để xem offline'}
              busy={save.isPending}
              disabled={!canSave}
              disabledReason="Cần tải được các vé đã phát hành trước khi lưu đơn."
              onPress={() => save.mutate(tickets.data ?? [])}
            />
            <MenuRow
              label="Liên hệ hỗ trợ"
              onPress={() => router.push({ pathname: '/support', params: { bookingId } })}
            />
            <MenuRow label="Đơn của tôi" onPress={() => router.replace('/orders')} />
          </MenuGroup>
          {!!save.error && <ErrorNotice error={save.error} />}
          {booking.bookingType === 'BUSINESS' && (
            <Disclosure title="Thông tin hóa đơn">
              <DetailRow label="Doanh nghiệp" />
              <DetailRow label="Mã số thuế" />
              <DetailRow label="Email nhận hóa đơn" />
              <UnavailableAction
                label="Xem hóa đơn"
                reason="Chưa thể tải thông tin hóa đơn của đơn doanh nghiệp."
              />
            </Disclosure>
          )}
        </>
      )}
    </Screen>
  );
}
export default function BookingResultScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
