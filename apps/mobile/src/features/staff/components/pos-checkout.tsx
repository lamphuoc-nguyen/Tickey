import { formatMoney } from '@event/core';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Copy, ErrorNotice, Notice, QueryState, c, fonts } from '@/components/ui';
import { bookingLabels, canCancel, canPay } from '@/features/customer/booking/booking-presentation';
import { ServerTicketQr } from '@/features/customer/tickets/components/server-ticket-qr';
import { usePosAdmission, usePosBooking, usePosCancel, usePosPayment } from '../hooks/use-pos-checkout';
import { formatHold, posStage } from '../lib/pos-sale';
import { StaffCard, StaffStatus } from './staff-ui';

/** One sale after the hold: take payment, wait for the tickets, show the gate QR to the buyer. */
export function PosCheckout({
  bookingId,
  onChanged,
  onClose,
}: {
  bookingId: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const query = usePosBooking(bookingId);
  const booking = query.data;
  const stage = booking ? posStage(booking.status) : undefined;
  const admission = usePosAdmission(bookingId, stage === 'ISSUED');
  const payment = usePosPayment(bookingId);
  const cancel = usePosCancel(bookingId);
  const status = booking?.status;
  useEffect(() => {
    if (status) onChanged();
  }, [status, onChanged]);

  if (!booking)
    return (
      <>
        <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
        <Button secondary onPress={onClose}>
          Về danh sách bán vé
        </Button>
      </>
    );

  return (
    <View style={styles.stack}>
      <StaffCard>
        <Text style={styles.code}>Đơn {booking.code}</Text>
        <StaffStatus tone={stage === 'ISSUED' ? 'success' : stage === 'CLOSED' ? 'danger' : 'warning'}>
          {bookingLabels[booking.status]}
        </StaffStatus>
        {booking.items.map((item, index) => (
          <Copy key={item.seatId ?? `${item.ticketTypeId}:${index}`} style={styles.detail}>
            {item.seatCode ? `Ghế ${item.seatCode}` : `Khu đứng × ${item.quantity}`} ·{' '}
            {formatMoney(item.unitPrice)}
          </Copy>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.detail}>{booking.itemCount} vé</Text>
          <Text style={styles.total}>{formatMoney(booking.totalAmount)}</Text>
        </View>
        {stage === 'AWAITING_PAYMENT' && (
          <Copy style={styles.detail}>Giữ chỗ còn {formatHold(query.remainingMs)}</Copy>
        )}
      </StaffCard>

      {!!query.error && <ErrorNotice error={query.error} />}

      {stage === 'AWAITING_PAYMENT' && (
        <>
          {booking.status === 'PAYMENT_PENDING' && (
            <Notice warning>
              Đã mở thanh toán. Nếu khách đã trả, vé sẽ tự phát ở đây. Có thể thử lại nếu khách chưa trả; đơn
              không huỷ được ở bước này và chỗ tự nhả khi hết hạn giữ.
            </Notice>
          )}
          {!!payment.error && <ErrorNotice error={payment.error} />}
          <Button
            busy={payment.isPending}
            disabled={!canPay(booking, query.remainingMs)}
            disabledReason="Đã hết thời gian giữ chỗ."
            onPress={() => payment.mutate()}
          >
            {`Thu ${formatMoney(booking.totalAmount)}`}
          </Button>
          {canCancel(booking) && (
            <Button secondary busy={cancel.isPending} onPress={() => cancel.mutate()}>
              Huỷ giữ chỗ
            </Button>
          )}
          {!!cancel.error && <ErrorNotice error={cancel.error} />}
        </>
      )}

      {stage === 'ISSUING' && (
        <StaffCard style={styles.waiting}>
          <ActivityIndicator color={c.primary} accessibilityLabel="Đang phát hành vé" />
          <Copy style={styles.centered}>Đã nhận thanh toán. Đang phát hành vé.</Copy>
        </StaffCard>
      )}

      {(stage === 'ISSUING' || booking.status === 'PAYMENT_PENDING') && (
        <Button secondary busy={query.isFetching} onPress={() => void query.refetch()}>
          Kiểm tra lại trạng thái
        </Button>
      )}

      {stage === 'ISSUED' && (
        <StaffCard style={styles.waiting}>
          <QueryState
            loading={admission.isPending}
            error={admission.error}
            retry={() => void admission.refetch()}
            compact
          />
          {admission.data && (
            <>
              <Text style={styles.code}>Mã vào cổng của đơn</Text>
              <ServerTicketQr encodedCredential={admission.data.qr} />
              <Copy style={styles.centered}>
                {admission.data.qr
                  ? `Khách đưa mã này tại cổng. Còn ${admission.data.remaining}/${admission.data.total} lượt vào.`
                  : 'Đang ký mã vào cổng.'}
              </Copy>
            </>
          )}
        </StaffCard>
      )}

      {payment.data?.testMode && stage !== 'AWAITING_PAYMENT' && (
        <Notice warning>Chế độ thử nghiệm: đơn này được xác nhận mà không thu tiền thật.</Notice>
      )}

      {stage === 'CLOSED' && <Notice>Đơn đã kết thúc. Không thể thu tiền hay vào cổng bằng đơn này.</Notice>}

      <Button secondary={stage === 'AWAITING_PAYMENT'} onPress={onClose}>
        {stage === 'AWAITING_PAYMENT' ? 'Để sau, về danh sách bán vé' : 'Bán đơn mới'}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  code: { color: c.text, fontFamily: fonts.heading, fontSize: 17 },
  detail: { color: c.muted, fontFamily: fonts.regular, fontSize: 12 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { color: c.primary, fontFamily: fonts.heading, fontSize: 20 },
  waiting: { alignItems: 'center' },
  centered: { textAlign: 'center' },
});
