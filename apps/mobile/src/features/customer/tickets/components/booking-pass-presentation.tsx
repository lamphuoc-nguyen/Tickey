import { formatSessionTime, type Admission, type Booking, type Order, type Ticket } from '@event/core';
import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';
import { Card, Copy, Heading, Notice, c, ui } from '@/components/ui';
import { Disclosure } from '@/components/customer-controls';
import { BookingStatusBadge } from '@/features/customer/booking/components/booking-status';
import { bookingTicketRecords } from '../booking-pass';
import { admissionPresentation } from '../admission-presentation';
import { ticketStatusLabels } from '../ticket-status';
import { ServerTicketQr } from './server-ticket-qr';

export function BookingPassPresentation({
  booking,
  order,
  admission,
  savedQr,
  tickets: suppliedTickets,
  online,
  downloadedAt,
  stale = false,
  admissionLoading = false,
  admissionFailed = false,
}: {
  booking?: Booking;
  order?: Order;
  /** Online: the server's gate QR and entry counts. */
  admission?: Admission;
  /** Offline: the gate QR saved with the booking; counts are unknown without the server. */
  savedQr?: string;
  tickets: readonly Ticket[];
  online: boolean;
  downloadedAt?: string;
  stale?: boolean;
  admissionLoading?: boolean;
  admissionFailed?: boolean;
}) {
  const bookingId = booking?.id ?? order?.id ?? admission?.bookingId ?? suppliedTickets[0]?.bookingId;
  const tickets = bookingTicketRecords(suppliedTickets, bookingId);
  const first = tickets[0];
  const event = order?.session?.event ?? first?.session?.event;
  const startsAt = order?.session?.startsAt ?? first?.session?.startsAt;
  const venue = first?.session?.venue;
  const cancelled = tickets.some((t) => t.session?.status === 'CANCELLED');
  const pass = admissionPresentation({
    bookingId,
    status: booking?.status ?? order?.status,
    admission,
    savedQr,
    online,
    failed: admissionFailed,
    cancelled,
  });
  const count = booking?.itemCount ?? order?.itemCount ?? pass.total;
  const waitingForCode =
    online &&
    pass.eligible &&
    !pass.qr &&
    !admissionFailed &&
    (admissionLoading || (!!admission && admission.qr === null && admission.remaining > 0));
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
        {pass.status && <BookingStatusBadge status={pass.status} />}
        {(booking?.code ?? order?.code) && (
          <Copy selectable style={ui.muted}>
            Mã đơn: {booking?.code ?? order?.code}
          </Copy>
        )}
      </View>
      <Card style={{ alignItems: 'stretch' }}>
        <Copy accessibilityRole="header" style={[ui.subheading, { textAlign: 'center' }]}>
          {pass.eligible ? 'Mã vào cổng của đơn' : 'Trạng thái vé'}
        </Copy>
        {/* One server-signed QR for the whole booking; staff choose how many people enter per scan. */}
        {pass.qr ? (
          <View style={{ alignItems: 'center' }}>
            <ServerTicketQr encodedCredential={pass.qr} />
          </View>
        ) : (
          <View style={{ minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            {waitingForCode && (
              <ActivityIndicator color={c.primary} accessibilityLabel="Đang tải mã vào cổng" />
            )}
            <Copy style={[ui.muted, { textAlign: 'center' }]}>{pass.description}</Copy>
          </View>
        )}
        {!!pass.qr && <Copy style={[ui.muted, { textAlign: 'center' }]}>{pass.description}</Copy>}
        <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap', paddingTop: 12 }]}>
          <Copy style={ui.muted}>{count === undefined ? 'Chỗ đã lưu / tải' : 'Số chỗ trong đơn'}</Copy>
          <Copy style={[ui.semibold, { fontSize: 22 }]}>{count ?? tickets.length}</Copy>
        </View>
      </Card>
      <View style={{ gap: 8 }}>
        <Heading small>Lượt vào cổng</Heading>
        <View style={[ui.row, { alignItems: 'stretch', gap: 8 }]}>
          {[
            { label: 'Đã vào cổng', value: pass.used === undefined ? '—' : String(pass.used) },
            { label: 'Lượt còn lại', value: pass.remaining === undefined ? '—' : String(pass.remaining) },
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
        {pass.remaining === undefined && (
          <Copy style={ui.muted}>
            {online ? 'Chưa có thông tin lượt sử dụng.' : 'Kết nối mạng để xem số lượt đã dùng.'}
          </Copy>
        )}
      </View>
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
