import { useLocalSearchParams, router } from 'expo-router';
import { Pressable } from 'react-native';
import { formatMoney } from '@event/core';
import { Button, Card, Copy, Field, Heading, QueryState, Screen, ui } from '@/components/ui';
import { DetailRow, Unavailable, UnavailableAction } from '@/components/detail';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { useBooking } from '@/features/customer/booking/hooks/use-booking';
import { useBookingTickets } from '@/features/customer/tickets/hooks/use-ticket';
import { useFormDraft } from '@/features/forms/use-form-draft';
function Content() {
  const { bookingId = '' } = useLocalSearchParams<{ bookingId: string }>();
  const booking = useBooking(bookingId),
    tickets = useBookingTickets(bookingId);
  const { draft, update } = useFormDraft(`request-refund:${bookingId}`, {
    selected: [] as string[],
    reason: '',
  });
  const list = tickets.data ?? [],
    selected = draft.selected.filter((id) => list.some((t) => t.id === id && t.status === 'ISSUED'));
  const ineligible = !!tickets.data?.length && tickets.data.every((t) => t.status !== 'ISSUED');
  return (
    <Screen
      footer={
        <UnavailableAction
          label="Gửi yêu cầu hoàn"
          reason="Yêu cầu hoàn tiền chủ động chưa được hỗ trợ. Lựa chọn và lý do chưa được gửi."
        />
      }
    >
      <Heading>{ineligible ? 'Chưa thể yêu cầu hoàn' : 'Yêu cầu hoàn tiền'}</Heading>
      <Unavailable>
        Chức năng yêu cầu hoàn tiền chủ động chưa được hỗ trợ. Bạn có thể xem vé và chuẩn bị lý do; không có
        yêu cầu nào được gửi.
      </Unavailable>
      <QueryState
        loading={booking.isPending || tickets.isPending}
        error={booking.error ?? tickets.error}
        retry={() => {
          void booking.refetch();
          void tickets.refetch();
        }}
        empty={!tickets.isPending && !tickets.error && !list.length}
        emptyText="Chưa có vé được phát hành trong đơn này."
      />
      {list.map((ticket, i) => (
        <Card key={ticket.id}>
          <Heading small>Vé {i + 1}</Heading>
          <DetailRow label="Ghế / khu" value={ticket.seat?.seatCode ?? 'Khu đứng'} />
          <DetailRow label="Hạng" value={ticket.ticketType?.name} />
          <Pressable
            disabled={ticket.status !== 'ISSUED'}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: selected.includes(ticket.id),
              disabled: ticket.status !== 'ISSUED',
            }}
            onPress={() =>
              update({
                selected: selected.includes(ticket.id)
                  ? selected.filter((id) => id !== ticket.id)
                  : [...selected, ticket.id],
              })
            }
            style={[ui.card, { minHeight: 48 }]}
          >
            <Copy>{selected.includes(ticket.id) ? '✓ Đã chọn' : 'Chọn vé'}</Copy>
          </Pressable>
          {ticket.status !== 'ISSUED' && (
            <Copy style={ui.muted}>Vé này không ở trạng thái có thể chọn để chuẩn bị yêu cầu hoàn.</Copy>
          )}
        </Card>
      ))}
      <Card>
        <DetailRow label="Số vé chọn" value={String(selected.length)} />
        <DetailRow
          label="Số tiền đã thanh toán của đơn"
          value={booking.data ? formatMoney(booking.data.totalAmount) : null}
        />
        <Copy style={ui.muted}>Chưa có thông tin xác nhận số tiền được hoàn.</Copy>
      </Card>
      <Field
        label="Lý do"
        value={draft.reason}
        onChangeText={(reason) => update({ reason })}
        multiline
        placeholder="Nhập lý do bạn muốn yêu cầu hoàn tiền"
        helper={!draft.reason.trim() ? 'Nhập lý do trước khi gửi khi chức năng được hỗ trợ.' : undefined}
      />
      {list.map((t) => (
        <Button
          key={t.id}
          secondary
          onPress={() => router.push({ pathname: '/reports/new', params: { ticketId: t.id } })}
        >
          Gửi phản ánh về vé {t.seat?.seatCode ?? t.id}
        </Button>
      ))}
      <Button
        secondary
        onPress={() => router.replace({ pathname: '/booking/[bookingId]', params: { bookingId } })}
      >
        Về đơn
      </Button>
    </Screen>
  );
}
export default function RefundRequestScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
