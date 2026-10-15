import { formatMoney } from '@event/core';
import { router, useLocalSearchParams } from 'expo-router';
import { ActionFooter, Button, Card, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { DetailRow, ResultPanel, UnavailableAction } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBookingTickets } from '@/features/customer/tickets/hooks/use-ticket';
import { useBooking } from '../hooks/use-booking';
import { bookingOutcome } from '../booking-outcome';
function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId),
    tickets = useBookingTickets(bookingId);
  const booking = query.data;
  const confirmed = booking?.status === 'CONFIRMED';
  return (
    <Screen
      footer={
        <ActionFooter
          busy={query.isRefetching}
          onPress={() =>
            confirmed ? router.replace({ pathname: '/tickets', params: { bookingId } }) : void query.refetch()
          }
        >
          {confirmed ? 'Mở vé của tôi' : 'Kiểm tra trạng thái'}
        </ActionFooter>
      }
    >
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {booking && (
        <>
          {!!query.error && (
            <Notice warning>
              Đang hiển thị thông tin từ lần tải trước. Chưa xác nhận được trạng thái mới.
            </Notice>
          )}
          {confirmed ? (
            <>
              <Heading>{bookingOutcome(booking).title}</Heading>
              <Notice success>{bookingOutcome(booking).description}</Notice>
            </>
          ) : (
            <ResultPanel {...bookingOutcome(booking)} />
          )}
          {confirmed && (
            <>
              <Card>
                <Heading small>{booking.code}</Heading>
                <DetailRow label="Số vé" value={String(booking.itemCount)} />
                <DetailRow label="Đã trả" value={formatMoney(booking.totalAmount)} />
              </Card>
              <QueryState
                loading={tickets.isPending}
                error={tickets.error}
                retry={() => void tickets.refetch()}
                empty={!tickets.isPending && !tickets.error && !tickets.data?.length}
                emptyText="Chưa thể tải vé đã phát hành."
              />
              {tickets.data?.map((t, i) => (
                <Button
                  key={t.id}
                  secondary
                  onPress={() => router.push({ pathname: '/tickets/[ticketId]', params: { ticketId: t.id } })}
                >
                  Vé {i + 1} · {t.holderName ?? t.seat?.seatCode ?? t.ticketType?.name ?? 'Xem vé'}
                </Button>
              ))}
            </>
          )}
          {booking.bookingType === 'BUSINESS' && (
            <>
              <Heading small>Thông tin hóa đơn</Heading>
              <Card>
                <DetailRow label="Doanh nghiệp" />
                <DetailRow label="Mã số thuế" />
                <DetailRow label="Email nhận hóa đơn" />
              </Card>
              <UnavailableAction
                label="Xem hóa đơn"
                reason="Chưa thể tải thông tin hóa đơn của đơn doanh nghiệp."
              />
            </>
          )}
          {booking.status === 'REFUND_PENDING' && (
            <Notice warning>Đang xử lý hoàn tiền. Chưa có xác nhận đã hoàn tất.</Notice>
          )}
          <Button secondary onPress={() => router.replace('/orders')}>
            Về Đơn của tôi
          </Button>
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
