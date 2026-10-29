import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Copy, QueryState, c, fonts } from '@/components/ui';
import { StaffCard, StaffFrame, StaffSectionTitle, StaffStatus } from '../components/staff-ui';
import { useSelectedStaffShift } from '../hooks/use-selected-staff-shift';
import { createStaffPosBooking, getStaffTicketTypes } from '../lib/staff-api';

export default function StaffPosScreen() {
  const { selected, query: shiftsQuery } = useSelectedStaffShift();
  const ticketTypes = useQuery({
    queryKey: ['staff-ticket-types', selected?.sessionId],
    queryFn: () => getStaffTicketTypes(selected!.sessionId),
    enabled: !!selected?.sessionId,
  });
  const [selectedId, setSelectedId] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const [booking, setBooking] = useState<{ code: string; status: string; total_amount: number } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const chosen = ticketTypes.data?.find((ticket) => ticket.id === (selectedId ?? ticketTypes.data?.[0]?.id));
  const total = (chosen?.price_amount ?? 0) * quantity;

  const createBooking = async () => {
    if (!selected || !chosen) return;
    setError(null);
    try {
      setBooking(
        await createStaffPosBooking({
          sessionId: selected.sessionId,
          ticketTypeId: chosen.id,
          zoneId: chosen.zones[0]?.zone_id,
          quantity,
        }),
      );
    } catch (cause) {
      setError(cause);
    }
  };

  if (shiftsQuery.isPending || ticketTypes.isPending) {
    return (
      <StaffFrame title="Bán vé tại quầy" active="pos">
        <QueryState loading />
      </StaffFrame>
    );
  }
  if (!selected) {
    return (
      <StaffFrame title="Bán vé tại quầy" active="pos">
        <QueryState empty emptyText="Chưa có session được phân công." />
      </StaffFrame>
    );
  }
  if (ticketTypes.isError) {
    return (
      <StaffFrame title="Bán vé tại quầy" active="pos">
        <QueryState error={ticketTypes.error} retry={() => void ticketTypes.refetch()} />
      </StaffFrame>
    );
  }

  return (
    <StaffFrame
      title="Bán vé tại quầy"
      subtitle={`${selected.session?.title ?? 'Session'} · POS`}
      active="pos"
    >
      <StaffStatus tone={selected.permissions.includes('POS') ? 'success' : 'danger'}>
        {selected.permissions.includes('POS')
          ? 'Được phép tạo booking POS'
          : 'Assignment không có permission POS'}
      </StaffStatus>
      {booking ? (
        <StaffCard style={booking.status === 'PENDING' ? styles.pendingCard : styles.resultCard}>
          <Text style={styles.bookingTitle}>Booking {booking.code}</Text>
          <Text style={styles.bookingDetail}>Database trả về trạng thái: {booking.status}</Text>
          <Text style={styles.bookingDetail}>
            Tổng tiền: {booking.total_amount.toLocaleString('vi-VN')} ₫
          </Text>
          <Text style={styles.warning}>
            POS booking chưa tự động thành PAID. Cần payment flow/gateway được cấu hình.
          </Text>
        </StaffCard>
      ) : null}
      <View style={{ gap: 10 }}>
        <StaffSectionTitle>Ticket type từ database</StaffSectionTitle>
        {(ticketTypes.data ?? []).map((ticket) => {
          const active = ticket.id === (selectedId ?? ticketTypes.data?.[0]?.id);
          const remaining = ticket.inventory
            ? ticket.inventory.quota - ticket.inventory.locked - ticket.inventory.sold
            : undefined;
          return (
            <Pressable
              key={ticket.id}
              onPress={() => {
                setSelectedId(ticket.id);
                setBooking(null);
              }}
              accessibilityRole="radio"
            >
              <StaffCard style={active ? styles.selected : undefined}>
                <View style={styles.ticketRow}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={styles.ticketName}>{ticket.name}</Text>
                    <Text style={styles.ticketDetail}>{ticket.description ?? ticket.kind}</Text>
                    <Text style={styles.ticketPrice}>{ticket.price_amount.toLocaleString('vi-VN')} ₫</Text>
                    <Text style={styles.ticketDetail}>
                      {remaining === undefined ? 'Kho chưa trả về' : `Còn ${remaining} vé`}
                    </Text>
                  </View>
                  <Text style={active ? styles.check : styles.circle}>{active ? '✓' : '○'}</Text>
                </View>
              </StaffCard>
            </Pressable>
          );
        })}
      </View>
      {chosen ? (
        <StaffCard>
          <View style={styles.quantityRow}>
            <Text style={styles.ticketName}>Số lượng</Text>
            <View style={styles.quantityBox}>
              <Pressable
                onPress={() => setQuantity((value) => Math.max(1, value - 1))}
                style={styles.quantityButton}
              >
                <Text style={styles.quantityText}>−</Text>
              </Pressable>
              <Text style={styles.quantity}>{quantity}</Text>
              <Pressable onPress={() => setQuantity((value) => value + 1)} style={styles.quantityButton}>
                <Text style={styles.quantityText}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tổng dự kiến</Text>
            <Text style={styles.totalValue}>{total.toLocaleString('vi-VN')} ₫</Text>
          </View>
        </StaffCard>
      ) : null}
      <Button
        disabled={!chosen || !selected.permissions.includes('POS')}
        onPress={() => void createBooking()}
      >
        Tạo booking POS
      </Button>
      {error ? <QueryState error={error} /> : null}
      <Copy style={styles.note}>
        Chỉ gửi ticket_type_id, zone_id và quantity. Giá/stock do database quyết định.
      </Copy>
    </StaffFrame>
  );
}

const styles = StyleSheet.create({
  selected: { borderColor: c.primary, borderWidth: 1.5, backgroundColor: c.tint },
  ticketRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ticketName: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  ticketDetail: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  ticketPrice: { color: c.primary, fontFamily: fonts.semibold, fontSize: 13, marginTop: 3 },
  check: { color: c.primary, fontFamily: fonts.heading, fontSize: 26 },
  circle: { color: c.muted, fontFamily: fonts.heading, fontSize: 26 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quantityBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: { color: c.primary, fontFamily: fonts.heading, fontSize: 20 },
  quantity: { color: c.text, fontFamily: fonts.semibold, fontSize: 14, minWidth: 18, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  summaryLabel: { color: c.muted, fontFamily: fonts.regular, fontSize: 12 },
  totalValue: { color: c.primary, fontFamily: fonts.heading, fontSize: 20 },
  pendingCard: { backgroundColor: c.amberTint, borderColor: '#F3D79B', gap: 5 },
  resultCard: { backgroundColor: '#E8F5EF', borderColor: '#B9E3CC', gap: 5 },
  bookingTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 17 },
  bookingDetail: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  warning: { color: '#946018', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
  note: { color: c.muted, fontSize: 11, lineHeight: 17 },
});
