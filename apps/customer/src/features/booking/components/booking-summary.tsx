import { formatMoney, formatSessionTime, type Booking } from '@event/core';
import { Image } from 'expo-image';
import { Card, Copy, Heading, QueryState, ui } from '@/components/ui';
import { DetailRow } from '@/components/detail';
import { useOrder } from '@/features/tickets/hooks/use-ticket';
import { useSessions, useTicketTypes } from '@/features/catalog/hooks/use-catalog';

export function BookingSummary({ booking }: { booking?: Booking }) {
  const order = useOrder(booking?.id ?? '');
  const sessions = useSessions(order.data?.session?.event?.id ?? '');
  const types = useTicketTypes(booking?.sessionId ?? '');
  const session = sessions.data?.find((s) => s.id === booking?.sessionId);
  return (
    <>
      {order.data?.session?.event?.coverImageUrl && (
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
      {booking?.items.map((item, i) => (
        <Card key={`${item.seatId ?? item.zoneId}:${i}`}>
          <Heading small>
            Vé {i + 1}
            {item.quantity > 1 ? ` · ${item.quantity} vé` : ''}
          </Heading>
          <DetailRow label="Ghế / khu" value={item.seatCode ?? 'Khu đứng'} />
          <DetailRow label="Hạng" value={types.data?.find((t) => t.id === item.ticketTypeId)?.name} />
          <DetailRow label="Cổng" />
          <DetailRow label="Giá" value={formatMoney(item.unitPrice)} />
          {item.unitDiscount > 0 && <DetailRow label="Giảm giá" value={formatMoney(item.unitDiscount)} />}
        </Card>
      ))}
      {!booking && (
        <Card>
          <Heading small>Thông tin vé</Heading>
          <DetailRow label="Ghế / khu" />
          <DetailRow label="Hạng" />
          <DetailRow label="Cổng" />
          <DetailRow label="Giá" />
        </Card>
      )}
      <Card>
        <DetailRow label="Tổng tiền" value={booking ? formatMoney(booking.totalAmount) : null} />
      </Card>
    </>
  );
}
