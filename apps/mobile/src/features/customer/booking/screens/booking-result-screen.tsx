import { router, useLocalSearchParams } from 'expo-router';
import { ActionFooter, ErrorNotice, Heading, Notice, QueryState, Screen } from '@/components/ui';
import { Disclosure, MenuGroup, MenuRow } from '@/components/customer-controls';
import { DetailRow, UnavailableAction } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import {
  useBookingAdmission,
  useConnection,
  useBookingTickets,
  useOrder,
  useSaveBookingTickets,
  useSavedAdmissions,
} from '@/features/customer/tickets/hooks/use-ticket';
import { BookingPassPresentation } from '@/features/customer/tickets/components/booking-pass-presentation';
import { useBooking } from '../hooks/use-booking';
import { BuyerInfo } from '../components/buyer-info';
import { orderHistoryRoute } from '@/features/customer/tickets/order-presentation';
import { canSaveBookingPass } from '@/features/customer/tickets/admission-presentation';

function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId);
  const order = useOrder(bookingId);
  const booking = query.data;
  const online = useConnection();
  const savedAdmissions = useSavedAdmissions();
  const issued =
    !!booking && ['CONFIRMED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(booking.status);
  const tickets = useBookingTickets(bookingId, issued);
  const admission = useBookingAdmission(bookingId, issued);
  const save = useSaveBookingTickets();
  const firstTicket = tickets.data?.[0];
  const cancelledTicket = tickets.data?.find((ticket) => ticket.session?.status === 'CANCELLED');
  const canSave =
    online &&
    issued &&
    canSaveBookingPass(bookingId, tickets.data ?? [], admission.data) &&
    !tickets.error &&
    !query.error &&
    !order.error &&
    !admission.error;
  const refreshPass = () => {
    void query.refetch();
    void order.refetch();
    if (issued) {
      void tickets.refetch();
      void admission.refetch();
    }
  };
  const hasCode = issued && !!admission.data?.qr && !admission.error;
  return (
    <Screen
      footer={
        <ActionFooter
          busy={query.isRefetching || admission.isFetching}
          onPress={() =>
            !online
              ? router.push({ pathname: '/tickets/offline', params: { bookingId } })
              : hasCode
                ? router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } })
                : refreshPass()
          }
        >
          {!online ? 'Vé đã lưu' : hasCode ? 'Chi tiết đơn' : 'Kiểm tra trạng thái'}
        </ActionFooter>
      }
    >
      <Heading>
        {booking?.status === 'PAID'
          ? 'Đang phát hành vé'
          : booking?.status === 'CONFIRMED'
            ? 'Đặt vé thành công'
            : 'Vé vào cổng'}
      </Heading>
      {!online && !booking && (
        <Notice warning>Bạn đang ngoại tuyến. Mở vé đã lưu trên thiết bị để xem.</Notice>
      )}
      <QueryState
        loading={online && query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {booking && (
        <>
          <QueryState error={order.error} retry={() => void order.refetch()} compact />
          {issued && (
            <QueryState
              loading={online && tickets.isPending}
              error={tickets.error}
              retry={() => void tickets.refetch()}
              empty={!tickets.isPending && !tickets.error && !tickets.data?.length}
              emptyText="Chưa tải được thông tin các chỗ trong đơn."
              compact
            />
          )}
          {issued && <QueryState error={admission.error} retry={() => void admission.refetch()} compact />}
          <BookingPassPresentation
            booking={booking}
            order={order.data}
            admission={admission.data}
            tickets={tickets.data ?? []}
            online={online}
            savedQr={
              !online
                ? admission.data
                  ? (admission.data.qr ?? undefined)
                  : savedAdmissions.data?.[bookingId]
                : undefined
            }
            downloadedAt={
              !online && admission.dataUpdatedAt ? new Date(admission.dataUpdatedAt).toISOString() : undefined
            }
            admissionLoading={online && issued && admission.isPending}
            admissionFailed={online && !!admission.error}
            stale={!!query.error || !!order.error || !!tickets.error || !!admission.error}
          />
          <BuyerInfo online={online} />
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
              busy={query.isRefetching || tickets.isRefetching || order.isRefetching || admission.isFetching}
              onPress={refreshPass}
            />
            <MenuRow
              icon="ticket"
              navigation={false}
              label={save.isSuccess ? 'Đã lưu thông tin vé trên thiết bị' : 'Lưu đơn để xem offline'}
              busy={save.isPending}
              disabled={!canSave}
              disabledReason="Cần tải được mã vào cổng và các vé còn lượt sử dụng trước khi lưu."
              onPress={() => save.mutate(tickets.data ?? [])}
            />
            <MenuRow
              label="Liên hệ hỗ trợ"
              onPress={() => router.push({ pathname: '/support/new', params: { bookingId } })}
            />
            <MenuRow label="Đơn của tôi" onPress={() => router.replace(orderHistoryRoute)} />
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
