import { credentialMatchesTicket, formatSessionTime, type Ticket } from '@event/core';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Card, Copy, Heading, Notice, c, ui } from '@/components/ui';
import { DetailRow } from '@/components/detail';
import { ticketStatusLabels } from '../ticket-status';
import { ServerTicketQr } from './server-ticket-qr';

/** Undefined means information is unavailable; never fabricate a ticket to fill its layout. */
export function TicketPresentation({
  ticket,
  online,
  downloadedAt,
  stale = false,
  position,
  count,
}: {
  ticket?: Ticket;
  online: boolean;
  downloadedAt?: string;
  stale?: boolean;
  position?: number;
  count?: number;
}) {
  const free = ticket?.ticketType?.kind === 'FREE';
  return (
    <>
      <Heading>
        {position !== undefined && position >= 0 && count
          ? `Vé ${position + 1} / ${count}`
          : free
            ? 'Vé miễn phí'
            : 'Vé điện tử'}
      </Heading>
      {ticket?.session?.event?.coverImageUrl ? (
        <Image
          source={ticket.session.event.coverImageUrl}
          contentFit="cover"
          style={{ height: 80, width: '100%', borderRadius: 10 }}
        />
      ) : (
        <View
          style={{
            height: 80,
            borderRadius: 10,
            backgroundColor: c.tint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Copy style={ui.muted}>Chưa có ảnh sự kiện</Copy>
        </View>
      )}
      <Heading small>{ticket?.session?.event?.title ?? 'Chưa tải được thông tin sự kiện'}</Heading>
      <Copy style={ui.muted}>
        {ticket?.session
          ? formatSessionTime(ticket.session.startsAt, ticket.session.venue?.timezone)
          : 'Chưa có thời gian suất diễn'}
      </Copy>
      <Copy style={ui.muted}>{ticket?.session?.venue?.name ?? 'Chưa có thông tin địa điểm'}</Copy>
      <Heading small>
        {ticket?.holderName ?? (ticket ? 'Chưa ghi tên người tham dự' : 'Chưa tải được người tham dự')}
      </Heading>
      <Card>
        <DetailRow label="Ghế / khu" value={ticket ? (ticket.seat?.seatCode ?? 'Khu đứng') : null} />
        <DetailRow label="Hạng vé" value={ticket?.ticketType?.name} />
        <DetailRow label="Cổng vào" />
        <DetailRow label="Nhóm giá" />
      </Card>
      <ServerTicketQr encodedCredential={null} />
      {ticket?.credential && !credentialMatchesTicket(ticket) && (
        <Notice warning>Thông tin mã vào cổng chưa hợp lệ. Vui lòng liên hệ hỗ trợ.</Notice>
      )}
      <Copy style={ui.semibold}>
        {position !== undefined && position >= 0 && count ? `Vé ${position + 1} / ${count} · ` : ''}
        {ticket ? ticketStatusLabels[ticket.status] : 'Chưa kiểm tra được trạng thái vé'}
      </Copy>
      <Copy style={ui.muted}>Mã vé: {ticket?.id ?? 'Chưa tải được'}</Copy>
      {stale && online && (
        <Notice warning>Đang hiển thị thông tin từ lần tải trước. Chưa kiểm tra được trạng thái mới.</Notice>
      )}
      {!online && (
        <Notice warning>
          Bản lưu: {downloadedAt ? formatSessionTime(downloadedAt) : 'chưa rõ thời điểm'}. Kết nối mạng để
          kiểm tra hiệu lực vé.
        </Notice>
      )}
    </>
  );
}
