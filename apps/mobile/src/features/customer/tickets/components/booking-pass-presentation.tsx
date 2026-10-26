import { formatSessionTime, type Booking, type Order, type Ticket } from '@event/core';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Card, Copy, Heading, Notice, c, ui } from '@/components/ui';
import { Disclosure } from '@/components/customer-controls';
import { BookingStatusBadge } from '@/features/customer/booking/components/booking-status';
import { bookingAdmissionState, bookingTicketRecords } from '../booking-pass';
import { ticketStatusLabels } from '../ticket-status';
import { ServerTicketQr } from './server-ticket-qr';

export function BookingPassPresentation({
  booking,
  order,
  tickets: suppliedTickets,
  online,
  downloadedAt,
  stale = false,
}: {
  booking?: Booking;
  order?: Order;
  tickets: readonly Ticket[];
  online: boolean;
  downloadedAt?: string;
  stale?: boolean;
}) {
  const bookingId = booking?.id ?? order?.id ?? suppliedTickets[0]?.bookingId;
  const tickets = bookingTicketRecords(suppliedTickets, bookingId);
  const first = tickets[0];
  const event = order?.session?.event ?? first?.session?.event;
  const startsAt = order?.session?.startsAt ?? first?.session?.startsAt;
  const venue = first?.session?.venue;
  const status = booking?.status ?? order?.status;
  const count = booking?.itemCount ?? order?.itemCount;
  const state = bookingAdmissionState(status);
  const cancelled = tickets.some((t) => t.session?.status === 'CANCELLED');
  const showCode =
    !cancelled && (!status || ['CONFIRMED', 'REFUND_PENDING', 'PARTIALLY_REFUNDED'].includes(status));
  return (
    <View style={{ gap: 16 }}>
      {event?.coverImageUrl && (
        <Image
          source={event.coverImageUrl}
          contentFit="cover"
          style={{ width: '100%', height: 140, borderRadius: 16 }}
        />
      )}
      <View style={{ gap: 6 }}>
        <Heading small>{event?.title ?? 'Vé của đơn'}</Heading>
        {startsAt && <Copy style={ui.muted}>{formatSessionTime(startsAt, venue?.timezone)}</Copy>}
        {venue && <Copy style={ui.muted}>{venue.name}</Copy>}
        {status && <BookingStatusBadge status={status} />}
        {(booking?.code ?? order?.code) && (
          <Copy selectable style={ui.muted}>
            Mã đơn: {booking?.code ?? order?.code}
          </Copy>
        )}
      </View>
      <Card style={{ alignItems: 'stretch' }}>
        <Heading small>{showCode ? 'Mã vào cổng của đơn' : 'Trạng thái vé'}</Heading>
        {/* Current contracts only expose per-ticket credentials. Never reuse one as a group QR. */}
        {showCode ? (
          <ServerTicketQr encodedCredential={null} />
        ) : (
          <>
            <Copy style={ui.semibold}>{cancelled ? 'Suất diễn đã bị hủy' : state.title}</Copy>
            <Copy style={ui.muted}>{cancelled ? 'Vé không dùng để vào cổng.' : state.description}</Copy>
          </>
        )}
        <View style={[ui.row, { alignItems: 'stretch', gap: 8, paddingTop: 8 }]}>
          {[
            { label: count === undefined ? 'Chỗ đã tải' : 'Số chỗ', value: String(count ?? tickets.length) },
            { label: 'Đã check-in', value: '—' },
            { label: 'Lượt còn lại', value: '—' },
          ].map((item) => (
            <View
              key={item.label}
              style={{
                flex: 1,
                minWidth: 0,
                gap: 4,
                alignItems: 'center',
                paddingVertical: 12,
                backgroundColor: c.tint,
                borderRadius: 10,
              }}
            >
              <Copy style={ui.semibold}>{item.value}</Copy>
              <Copy style={{ fontSize: 12, color: c.muted, textAlign: 'center' }}>{item.label}</Copy>
            </View>
          ))}
        </View>
        <Copy style={[ui.muted, { fontSize: 11 }]}>Chưa có thông tin lượt check-in.</Copy>
      </Card>
      {!!tickets.length && (
        <Disclosure title={`Ghế và hạng vé · ${tickets.length} chỗ đã tải`}>
          {tickets.map((ticket) => (
            <View
              key={ticket.id}
              style={{ gap: 4, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.border }}
            >
              <Copy style={ui.semibold}>
                {ticket.seat?.seatCode ??
                  (ticket.seatId
                    ? 'Chưa có thông tin ghế'
                    : ticket.zoneId
                      ? 'Khu đứng'
                      : 'Chỗ vào cổng')}{' '}
                · {ticket.ticketType?.name ?? 'Chưa có hạng vé'}
              </Copy>
              <Copy style={ui.muted}>{ticketStatusLabels[ticket.status]}</Copy>
            </View>
          ))}
        </Disclosure>
      )}
      {!online && (
        <Notice warning>
          Bản lưu: {downloadedAt ? formatSessionTime(downloadedAt) : 'chưa rõ thời điểm'}. Kết nối mạng để
          kiểm tra hiệu lực và lượt vào cổng.
        </Notice>
      )}
      {online && stale && (
        <Notice warning>Đang xem thông tin từ lần tải trước. Chưa xác nhận được trạng thái mới.</Notice>
      )}
    </View>
  );
}
