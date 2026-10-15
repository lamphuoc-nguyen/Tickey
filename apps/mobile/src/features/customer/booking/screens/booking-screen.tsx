import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, View } from 'react-native';
import {
  ActionFooter,
  Button,
  Card,
  Copy,
  ErrorNotice,
  Heading,
  Notice,
  QueryState,
  Screen,
} from '@/components/ui';
import { DetailRow, ResultPanel } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBookingTickets } from '@/features/customer/tickets/hooks/use-ticket';
import { useBooking, useCancelBooking } from '../hooks/use-booking';
import { bookingLabels, canCancel, canPay } from '../booking-presentation';
import { BookingSummary } from '../components/booking-summary';
function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId),
    cancel = useCancelBooking(),
    tickets = useBookingTickets(bookingId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const booking = query.data;
  const minutes = Math.floor(query.remainingMs / 60000),
    seconds = Math.floor(query.remainingMs / 1000) % 60;
  return (
    <Screen
      footer={
        booking && (
          <ActionFooter
            busy={query.isRefetching}
            disabled={!!query.error || (booking.status === 'PENDING' && !canPay(booking, query.remainingMs))}
            disabledReason={
              query.error
                ? 'Cần cập nhật được trạng thái đơn trước khi tiếp tục.'
                : 'Hết thời gian hiển thị giữ chỗ. Kiểm tra trạng thái mới nhất hoặc chọn lại.'
            }
            onPress={() =>
              booking.status === 'CONFIRMED'
                ? router.push({ pathname: '/booking/[bookingId]/result', params: { bookingId } })
                : canPay(booking, query.remainingMs)
                  ? router.push({ pathname: '/booking/[bookingId]/holder', params: { bookingId } })
                  : void query.refetch()
            }
          >
            {booking.status === 'CONFIRMED'
              ? 'Xem vé của đơn'
              : booking.status === 'PENDING'
                ? 'Thông tin người tham dự'
                : 'Kiểm tra trạng thái'}
          </ActionFooter>
        )
      }
    >
      <Heading>
        {booking?.status === 'PENDING'
          ? 'Kiểm tra đặt vé'
          : booking
            ? `Chi tiết đơn ${booking.code}`
            : 'Kiểm tra đặt vé'}
      </Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {!booking && (
        <>
          <BookingSummary />
          <Notice>Chưa thể tải đơn. Thử lại hoặc liên hệ hỗ trợ; không có thao tác nào được gửi.</Notice>
          <Button secondary onPress={() => router.push('/support')}>
            Liên hệ hỗ trợ
          </Button>
        </>
      )}
      {booking && (
        <>
          {booking.status === 'PENDING' && (
            <Notice>
              Thời gian giữ chỗ còn lại: {minutes}:{String(seconds).padStart(2, '0')}
              {query.remainingMs === 0 ? '. Đang cập nhật trạng thái.' : ''}
            </Notice>
          )}
          {booking.status === 'PAYMENT_PENDING' && (
            <ResultPanel
              title="Đang xác nhận thanh toán"
              description="Chưa có kết quả cuối cùng. Vui lòng không thanh toán lại."
            />
          )}
          {booking.status === 'PAID' && (
            <ResultPanel
              title="Đang phát hành vé"
              description="Đơn đã được thanh toán. Vé đang được phát hành."
            />
          )}
          {booking.status === 'EXPIRED' && (
            <ResultPanel
              title="Đã hết hạn giữ chỗ"
              description="Chỗ đã được trả lại. Vui lòng chọn chỗ mới."
              kind="expired"
            />
          )}
          {booking.status === 'CANCELLED' && (
            <ResultPanel
              title="Đơn đã hủy"
              description="Đơn không còn hiệu lực. Bạn có thể khám phá và chọn vé mới."
              kind="warning"
            />
          )}
          {booking.status === 'REFUND_PENDING' && (
            <Notice warning>Đang xử lý hoàn tiền. Chưa có xác nhận đã hoàn tất.</Notice>
          )}
          <Card>
            <DetailRow label="Trạng thái" value={bookingLabels[booking.status]} />
            <DetailRow label="Mã đơn" value={booking.code} />
          </Card>
          <BookingSummary booking={booking} />
          {booking.status === 'PENDING' && (
            <>
              <Notice>
                Giữ chỗ có thời hạn. Kiểm tra thông tin và thời gian giữ chỗ trước khi thanh toán.
              </Notice>
              <Button
                secondary
                onPress={() =>
                  router.push({ pathname: '/booking/[bookingId]/business', params: { bookingId } })
                }
              >
                Mua cho doanh nghiệp · Chưa hỗ trợ
              </Button>
              <Button
                secondary
                onPress={() =>
                  router.push({ pathname: '/booking/[bookingId]/audience', params: { bookingId } })
                }
              >
                Giá theo người tham dự · Chưa hỗ trợ
              </Button>
            </>
          )}
          {booking.status === 'CONFIRMED' && (
            <>
              <Heading small>Vé của đơn</Heading>
              <QueryState
                loading={tickets.isPending}
                error={tickets.error}
                retry={() => void tickets.refetch()}
                empty={!tickets.isPending && !tickets.error && !tickets.data?.length}
                emptyText="Chưa tải được vé đã phát hành."
              />
              {tickets.data?.map((t, i) => (
                <Button
                  key={t.id}
                  secondary
                  onPress={() => router.push({ pathname: '/tickets/[ticketId]', params: { ticketId: t.id } })}
                >
                  Vé {i + 1} · {t.seat?.seatCode ?? t.ticketType?.name ?? 'Xem vé'}
                </Button>
              ))}
              <Button
                secondary
                onPress={() =>
                  router.push({ pathname: '/booking/[bookingId]/refund-request', params: { bookingId } })
                }
              >
                Yêu cầu hoàn tiền · Chưa hỗ trợ
              </Button>
            </>
          )}
          {canCancel(booking) && (
            <Button
              secondary
              disabled={!!query.error}
              disabledReason="Cần cập nhật được trạng thái đơn trước khi hủy."
              onPress={() => setConfirmCancel(true)}
            >
              Hủy đơn đang giữ chỗ
            </Button>
          )}
          <Modal
            visible={confirmCancel}
            transparent
            animationType="fade"
            onRequestClose={() => {
              if (!cancel.isPending) setConfirmCancel(false);
            }}
          >
            <View
              accessibilityViewIsModal
              style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)', padding: 20 }}
            >
              <Card>
                <Heading>Hủy đơn đang giữ chỗ</Heading>
                <DetailRow label="Đơn" value={booking.code} />
                <DetailRow
                  label="Ghế đang giữ"
                  value={booking.items.map((i) => i.seatCode ?? 'Khu đứng').join(', ')}
                />
                <Copy>Chỉ hủy khi đơn cho phép. Chỗ được trả lại sau khi xác nhận hủy.</Copy>
                <Button
                  busy={cancel.isPending}
                  disabled={!canCancel(booking) || !!query.error}
                  disabledReason="Đơn hiện không cho phép hủy."
                  onPress={() => {
                    if (!cancel.isPending)
                      void cancel
                        .mutateAsync(booking.id)
                        .then(() => setConfirmCancel(false))
                        .catch(() => {});
                  }}
                >
                  Xác nhận hủy đơn
                </Button>
                <Button
                  secondary
                  disabled={cancel.isPending}
                  disabledReason="Đang xử lý hủy đơn."
                  onPress={() => setConfirmCancel(false)}
                >
                  Giữ đơn
                </Button>
                {!!cancel.error && <ErrorNotice error={cancel.error} />}
              </Card>
            </View>
          </Modal>
          {['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(booking.status) && (
            <Button secondary onPress={() => router.push({ pathname: '/refunds', params: { bookingId } })}>
              Theo dõi hoàn tiền
            </Button>
          )}
          {['EXPIRED', 'CANCELLED'].includes(booking.status) && (
            <Button onPress={() => router.replace('/')}>Khám phá và chọn lại vé</Button>
          )}
          <Button
            secondary
            onPress={() =>
              router.push({ pathname: '/booking/[bookingId]/payment-status', params: { bookingId } })
            }
          >
            Thông tin giao dịch
          </Button>
          <Button secondary onPress={() => router.push({ pathname: '/support', params: { bookingId } })}>
            Liên hệ hỗ trợ
          </Button>
          <Button secondary onPress={() => router.replace('/orders')}>
            Xem đơn của tôi
          </Button>
        </>
      )}
    </Screen>
  );
}
export default function BookingScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
