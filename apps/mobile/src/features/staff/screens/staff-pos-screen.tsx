import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Copy, c, fonts } from '@/components/ui';
import { StaffCard, StaffFrame, StaffSectionTitle, StaffStatus } from '../components/staff-ui';

const ticketTypes = [
  { id: 'standard', label: 'Vé tiêu chuẩn', detail: 'Khu vực chung', price: 250000 },
  { id: 'vip', label: 'Vé VIP', detail: 'Khu vực trước sân khấu', price: 650000 },
  { id: 'early', label: 'Vé early bird', detail: 'Số lượng giới hạn', price: 180000 },
];

export default function StaffPosScreen() {
  const [quantities, setQuantities] = useState<Record<string, number>>({ standard: 1, vip: 0, early: 0 });
  const [paid, setPaid] = useState(false);
  const totalItems = Object.values(quantities).reduce((sum, value) => sum + value, 0);
  const total = useMemo(
    () => ticketTypes.reduce((sum, ticket) => sum + ticket.price * (quantities[ticket.id] ?? 0), 0),
    [quantities],
  );

  const update = (id: string, delta: number) => {
    setPaid(false);
    setQuantities((current) => ({ ...current, [id]: Math.max(0, (current[id] ?? 0) + delta) }));
  };

  return (
    <StaffFrame title="Bán vé tại quầy" subtitle="Đêm 1 - Công G1 · POS-01" active="pos">
      <View style={styles.topRow}>
        <StaffStatus tone="success">POS online</StaffStatus>
        <Text style={styles.orderText}>Đơn mới · #{paid ? 'TK-2408' : '—'}</Text>
      </View>
      {paid ? (
        <StaffCard style={styles.paidCard}>
          <View style={styles.paidIcon}>
            <Text style={styles.paidIconText}>✓</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={styles.paidTitle}>Thanh toán thành công</Text>
            <Text style={styles.paidDetail}>Đã phát hành {totalItems} vé cho khách hàng.</Text>
          </View>
        </StaffCard>
      ) : null}
      <View style={{ gap: 10 }}>
        <StaffSectionTitle>Chọn loại vé</StaffSectionTitle>
        {ticketTypes.map((ticket) => (
          <StaffCard key={ticket.id} style={styles.ticketCard}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.ticketName}>{ticket.label}</Text>
              <Text style={styles.ticketDetail}>{ticket.detail}</Text>
              <Text style={styles.ticketPrice}>{ticket.price.toLocaleString('vi-VN')} ₫</Text>
            </View>
            <View style={styles.quantityBox}>
              <Pressable
                onPress={() => update(ticket.id, -1)}
                accessibilityRole="button"
                style={styles.quantityButton}
              >
                <Text style={styles.quantityText}>−</Text>
              </Pressable>
              <Text style={styles.quantity}>{quantities[ticket.id] ?? 0}</Text>
              <Pressable
                onPress={() => update(ticket.id, 1)}
                accessibilityRole="button"
                style={styles.quantityButton}
              >
                <Text style={styles.quantityText}>+</Text>
              </Pressable>
            </View>
          </StaffCard>
        ))}
      </View>
      <StaffCard style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Số lượng</Text>
          <Text style={styles.summaryValue}>{totalItems} vé</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Tạm tính</Text>
          <Text style={styles.summaryValue}>{total.toLocaleString('vi-VN')} ₫</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.totalLabel}>Tổng thanh toán</Text>
          <Text style={styles.totalValue}>{total.toLocaleString('vi-VN')} ₫</Text>
        </View>
      </StaffCard>
      <Button disabled={!totalItems} onPress={() => setPaid(true)}>
        Thanh toán POS
      </Button>
      <Copy style={styles.secure}>Chỉ hỗ trợ tiền mặt và chuyển khoản tại quầy</Copy>
    </StaffFrame>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderText: { color: c.muted, fontFamily: fonts.medium, fontSize: 11 },
  ticketCard: { flexDirection: 'row', alignItems: 'center' },
  ticketName: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  ticketDetail: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  ticketPrice: { color: c.primary, fontFamily: fonts.semibold, fontSize: 13, marginTop: 4 },
  quantityBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: { color: c.primary, fontFamily: fonts.heading, fontSize: 20, lineHeight: 22 },
  quantity: { color: c.text, fontFamily: fonts.semibold, fontSize: 14, minWidth: 16, textAlign: 'center' },
  summary: { gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: c.muted, fontFamily: fonts.regular, fontSize: 12 },
  summaryValue: { color: c.text, fontFamily: fonts.semibold, fontSize: 12 },
  divider: { height: 1, backgroundColor: c.border },
  totalLabel: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  totalValue: { color: c.primary, fontFamily: fonts.heading, fontSize: 21 },
  paidCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5EF',
    borderColor: '#B9E3CC',
  },
  paidIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paidIconText: { color: '#237857', fontFamily: fonts.heading, fontSize: 24 },
  paidTitle: { color: '#237857', fontFamily: fonts.semibold, fontSize: 14 },
  paidDetail: { color: '#237857', fontFamily: fonts.regular, fontSize: 11 },
  secure: { color: c.muted, fontSize: 10, textAlign: 'center' },
});
