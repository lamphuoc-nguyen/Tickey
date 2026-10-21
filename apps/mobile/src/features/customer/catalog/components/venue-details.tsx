import { Image } from 'expo-image';
import { formatSessionTime, type Ticket, type Session } from '@event/core';
import { Card, Copy, Heading, Notice, ui } from '@/components/ui';
type Venue = NonNullable<Session['venue']>;
export function VenueDetails({
  venue,
  doorsOpenAt,
  seatCode,
}: {
  venue: Venue | null | undefined;
  doorsOpenAt?: string;
  seatCode?: string | null;
}) {
  return (
    <>
      <Heading>Địa điểm tổ chức</Heading>
      {venue?.mapImageUrl ? (
        <>
          <Image
            source={venue.mapImageUrl}
            style={{ height: 148, width: '100%', borderRadius: 12 }}
            contentFit="contain"
          />
          <Copy style={ui.muted}>Sơ đồ do đơn vị tổ chức cung cấp</Copy>
        </>
      ) : (
        <>
          <Image
            source={require('../../../../../assets/figma/1-2125-imgPhotographyTheater.jpg')}
            style={{ height: 148, width: '100%', borderRadius: 12 }}
            contentFit="cover"
          />
          <Copy style={[ui.muted, { fontSize: 10 }]}>Ảnh minh họa địa điểm</Copy>
        </>
      )}
      <Card>
        <Copy style={ui.semibold}>{venue?.name ?? 'Chưa có tên địa điểm'}</Copy>
        <Copy style={ui.muted}>
          {venue
            ? [venue.addressLine, venue.ward, venue.district, venue.city].filter(Boolean).join(', ')
            : 'Chưa có địa chỉ được cung cấp.'}
        </Copy>
      </Card>
      <Card>
        <Copy style={ui.semibold}>Vị trí</Copy>
        <Copy style={ui.muted}>
          {seatCode
            ? `Ghế ${seatCode} · Đối chiếu hàng và số ghế trên vé`
            : 'Chưa có hướng dẫn vị trí cụ thể.'}
        </Copy>
      </Card>
      <Card>
        <Copy style={ui.semibold}>Mở cửa</Copy>
        <Copy style={ui.muted}>
          {doorsOpenAt ? formatSessionTime(doorsOpenAt, venue?.timezone) : 'Chưa có giờ mở cửa.'}
        </Copy>
      </Card>
      <Card>
        <Copy style={ui.semibold}>Cổng vào</Copy>
        <Copy style={ui.muted}>
          Chưa có thông tin cổng. Vui lòng xem chỉ dẫn tại địa điểm hoặc liên hệ hỗ trợ.
        </Copy>
      </Card>
      <Notice>Địa chỉ và hướng dẫn được Ban tổ chức cung cấp.</Notice>
    </>
  );
}
export function TicketVenueDetails({ ticket }: { ticket: Ticket }) {
  return (
    <VenueDetails
      venue={ticket.session?.venue}
      doorsOpenAt={ticket.session?.doorsOpenAt}
      seatCode={ticket.seat?.seatCode}
    />
  );
}
