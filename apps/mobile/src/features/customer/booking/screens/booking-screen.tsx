import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  c,
  ui,
} from '@/components/ui';
import { MenuGroup, MenuRow, TextAction } from '@/components/customer-controls';
import { DetailRow, ResultPanel } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBookingTickets } from '@/features/customer/tickets/hooks/use-ticket';
import { usePayment } from '@/features/customer/payment/hooks/use-payment';
import { useBooking, useCancelBooking } from '../hooks/use-booking';
import { bookingLabels, canCancel, canPay } from '../booking-presentation';
import { BookingSummary } from '../components/booking-summary';
function Content() {
  const insets = useSafeAreaInsets();
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const query = useBooking(bookingId),
    payment = usePayment(bookingId),
    cancel = useCancelBooking(),
    tickets = useBookingTickets(bookingId, query.data?.status === 'CONFIRMED');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const booking = query.data;
  const minutes = Math.floor(query.remainingMs / 60000),
    seconds = Math.floor(query.remainingMs / 1000) % 60;
  return (
    <Screen
      footer={
        booking && (
          <ActionFooter
            busy={query.isRefetching || payment.isPending}
            disabled={
              !!query.error ||
              (booking.status === 'PENDING' && !canPay(booking, query.remainingMs)) ||
              (booking.status === 'PAYMENT_PENDING' && !canPay(booking, query.remainingMs) && query.isRefetching)
            }
            disabledReason={
              query.error
                ? 'Cần cập nhật được trạng thái đơn trước khi tiếp tục.'
                : 'Hết thời gian hiển thị giữ chỗ. Kiểm tra trạng thái mới nhất hoặc chọn lại.'
            }
            onPress={() => {
              if (booking.status === 'CONFIRMED') {
                router.push({ pathname: '/booking/[bookingId]/result', params: { bookingId } });
              } else if (booking.status === 'PAYMENT_PENDING' && canPay(booking, query.remainingMs)) {
                payment.mutate();
              } else if (booking.status === 'PENDING' && canPay(booking, query.remainingMs)) {
                router.push({ pathname: '/booking/[bookingId]/holder', params: { bookingId } });
              } else {
                void query.refetch();
              }
            }}
          >
            {booking.status === 'CONFIRMED'
              ? 'Xem vé của đơn'
              : booking.status === 'PAYMENT_PENDING'
                ? canPay(booking, query.remainingMs)
                  ? 'Tiếp tục thanh toán'
                  : 'Tải lại'
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
          <TextAction onPress={() => router.push('/support')}>Liên hệ hỗ trợ</TextAction>
        </>
      )}
      {booking && (
        <>
          {booking.status === 'PENDING' && (
            <View
              style={[
                ui.row,
                {
                  padding: 12,
                  backgroundColor: c.tint,
                  borderRadius: 12,
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                },
              ]}
            >
              <Copy>{query.remainingMs === 0 ? 'Đang cập nhật giữ chỗ' : 'Giữ chỗ còn'}</Copy>
              <Copy style={[ui.semibold, { color: c.primary }]}>
                {minutes}:{String(seconds).padStart(2, '0')}
              </Copy>
            </View>
          )}
          {booking.status === 'PAYMENT_PENDING' && query.remainingMs > 0 && (
            <>
              <View
                style={[
                  ui.row,
                  {
                    padding: 12,
                    backgroundColor: c.tint,
                    borderRadius: 12,
                    flexWrap: 'wrap',
                    justifyContent: 'space-between',
                  },
                ]}
              >
                <Copy>Thời gian thanh toán còn</Copy>
                <Copy style={[ui.semibold, { color: c.primary }]}>
                  {minutes}:{String(seconds).padStart(2, '0')}
                </Copy>
              </View>
              <ResultPanel
                title="Đang xác nhận thanh toán"
                description="Chưa có kết quả cuối cùng từ cổng thanh toán. Bạn có thể tiếp tục thanh toán nếu giao dịch chưa hoàn tất."
              />
            </>
          )}
          {booking.status === 'PAYMENT_PENDING' && query.remainingMs <= 0 && (
            <ResultPanel
              title="Đang chờ xác nhận / sắp hết hạn"
              description="Chưa có kết quả cuối cùng từ cổng thanh toán. Đang kiểm tra trạng thái..."
            />
          )}
          {!!payment.error && <ErrorNotice error={payment.error} />}
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
            <MenuGroup title="Tùy chọn thêm">
              <MenuRow
                label="Mua cho doanh nghiệp"
                status="Chưa hỗ trợ"
                onPress={() =>
                  router.push({ pathname: '/booking/[bookingId]/business', params: { bookingId } })
                }
              />
              <MenuRow
                label="Giá theo người tham dự"
                status="Chưa hỗ trợ"
                onPress={() =>
                  router.push({ pathname: '/booking/[bookingId]/audience', params: { bookingId } })
                }
              />
            </MenuGroup>
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
              <MenuGroup>
                {tickets.data?.map((t, i) => (
                  <MenuRow
                    key={t.id}
                    icon="ticket"
                    label={`Vé ${i + 1} · ${t.seat?.seatCode ?? t.ticketType?.name ?? 'Xem vé'}`}
                    onPress={() =>
                      router.push({ pathname: '/tickets/[ticketId]', params: { ticketId: t.id } })
                    }
                  />
                ))}
              </MenuGroup>
              <MenuRow
                label="Yêu cầu hoàn tiền"
                status="Chưa hỗ trợ"
                onPress={() =>
                  router.push({ pathname: '/booking/[bookingId]/refund-request', params: { bookingId } })
                }
              />
            </>
          )}
          {canCancel(booking) && (
            <TextAction
              disabled={!!query.error}
              disabledReason="Cần cập nhật được trạng thái đơn trước khi hủy."
              onPress={() => setConfirmCancel(true)}
            >
              Hủy đơn
            </TextAction>
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
              style={{
                flex: 1,
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.25)',
                paddingHorizontal: 20,
                paddingTop: Math.max(insets.top, 20),
                paddingBottom: Math.max(insets.bottom, 20),
              }}
            >
              <Card style={{ maxHeight: '100%', flexShrink: 1 }}>
                <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 12 }}>
                  <Heading>Hủy đơn đang giữ chỗ</Heading>
                  <DetailRow label="Đơn" value={booking.code} />
                  <DetailRow
                    label="Ghế đang giữ"
                    value={booking.items.map((i) => i.seatCode ?? 'Khu đứng').join(', ')}
                  />
                  <Copy>Các chỗ trong đơn sẽ được trả lại khi hủy.</Copy>
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
                </ScrollView>
              </Card>
            </View>
          </Modal>
          {['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(booking.status) && (
            <MenuRow
              label="Theo dõi hoàn tiền"
              onPress={() => router.push({ pathname: '/refunds', params: { bookingId } })}
            />
          )}
          {['EXPIRED', 'CANCELLED'].includes(booking.status) && (
            <Button onPress={() => router.replace('/')}>Khám phá và chọn lại vé</Button>
          )}
          <MenuGroup>
            <MenuRow
              label="Thông tin giao dịch"
              onPress={() =>
                router.push({ pathname: '/booking/[bookingId]/payment-status', params: { bookingId } })
              }
            />
            <MenuRow
              label="Liên hệ hỗ trợ"
              onPress={() => router.push({ pathname: '/support', params: { bookingId } })}
            />
            <MenuRow label="Đơn của tôi" onPress={() => router.replace('/orders')} />
          </MenuGroup>
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
