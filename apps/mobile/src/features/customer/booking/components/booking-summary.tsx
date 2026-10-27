import { formatMoney, formatSessionTime, type Booking } from '@event/core';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Disclosure } from '@/components/customer-controls';
import { Card, Copy, Heading, QueryState, c, ui } from '@/components/ui';
import { DetailRow } from '@/components/detail';
import { useOrder } from '@/features/customer/tickets/hooks/use-ticket';
import { useSessions, useTicketTypes } from '@/features/customer/catalog/hooks/use-catalog';

export function BookingSummary({ booking, compact = false }: { booking?: Booking; compact?: boolean }) {
  const order = useOrder(booking?.id ?? '');
  const sessions = useSessions(order.data?.session?.event?.id ?? '');
  const types = useTicketTypes(booking?.sessionId ?? '');
  const session = sessions.data?.find((s) => s.id === booking?.sessionId);
  const ticketDetails = (
    <>
      {booking?.items.map((item, i) => (
        <View
          key={`${item.seatId ?? item.zoneId}:${i}`}
          style={{ gap: 6, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}
        >
          <Copy style={ui.semibold}>
            {item.seatCode ?? (item.seatId ? 'Chưa có thông tin ghế' : 'Khu đứng')} · {item.quantity} chỗ
          </Copy>
          <DetailRow label="Hạng" value={types.data?.find((t) => t.id === item.ticketTypeId)?.name} />
          <DetailRow label="Đơn giá" value={formatMoney(item.unitPrice)} />
          {item.unitDiscount > 0 && <DetailRow label="Giảm giá" value={formatMoney(item.unitDiscount)} />}
        </View>
      ))}
      {!booking && (
        <Card>
          <Heading small>Thông tin vé</Heading>
          <DetailRow label="Ghế / khu" />
          <DetailRow label="Hạng" />
          <DetailRow label="Giá" />
        </Card>
      )}
    </>
  );
  return (
    <>
      {!compact && order.data?.session?.event?.coverImageUrl && (
        <Image
          source={order.data.session.event.coverImageUrl}
          contentFit="cover"
          style={{ height: 90, width: '100%', borderRadius: 12 }}
        />
      )}
      <Heading small>{order.data?.session?.event?.title ?? 'Thông tin sự kiện'}</Heading>
      <Copy style={ui.muted}>
        {session
          ? formatSessionTime(session.startsAt, session.venue?.timezone)
          : order.data?.session?.startsAt
            ? formatSessionTime(order.data.session.startsAt)
            : 'Chưa có thời gian suất diễn.'}
      </Copy>
      <Copy style={ui.muted}>{session?.venue?.name ?? 'Chưa có thông tin địa điểm.'}</Copy>
      <QueryState
        error={order.error ?? sessions.error ?? types.error}
        retry={() => {
          void order.refetch();
          void sessions.refetch();
          void types.refetch();
        }}
        compact
      />
      {compact ? (
        <>
          {booking && (
            <View style={{ gap: 8, paddingVertical: 12 }}>
              <DetailRow label="Số lượng" value={`${booking.itemCount} chỗ`} />
              <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
                <Copy style={ui.semibold}>Tổng tiền</Copy>
                <Copy style={[ui.semibold, { fontSize: 22, color: c.primary }]}>
                  {formatMoney(booking.totalAmount)}
                </Copy>
              </View>
            </View>
          )}
          <Disclosure title="Ghế và hạng vé">
            {ticketDetails}
            <DetailRow label="Cổng vào" />
          </Disclosure>
        </>
      ) : (
        <>
          {ticketDetails}
          <Card>
            <DetailRow label="Tổng tiền" value={booking ? formatMoney(booking.totalAmount) : null} />
          </Card>
        </>
      )}
    </>
  );
}
