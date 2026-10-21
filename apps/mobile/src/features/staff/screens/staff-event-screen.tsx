import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Copy, c, fonts } from '@/components/ui';
import { EventImage, StaffCard, StaffFrame, StaffStatus } from '../components/staff-ui';

const events = [
  {
    id: 'g1',
    name: 'Đêm 1 - Công G1',
    subtitle: 'Live Music Festival',
    time: '19:00 · Hôm nay',
    status: 'Đang diễn ra',
  },
  {
    id: 'g2',
    name: 'Đêm 2 - Công G1',
    subtitle: 'Live Music Festival',
    time: '19:00 · Ngày mai',
    status: 'Sắp diễn ra',
  },
];

export default function StaffEventScreen() {
  return (
    <StaffFrame title="Chọn sự kiện" subtitle="Chọn sự kiện bạn đang làm việc hôm nay" back>
      <StaffStatus tone="info">Tổ chức: Công ty TNHH Live Music</StaffStatus>
      {events.map((event, index) => (
        <Pressable
          key={event.id}
          accessibilityRole="button"
          onPress={() => router.replace('/staff')}
          style={({ pressed }) => [styles.pressable, pressed && { opacity: 0.8 }]}
        >
          <StaffCard style={index === 0 ? styles.selected : undefined}>
            <View style={{ position: 'relative' }}>
              <EventImage height={112} />
              <View style={[styles.badge, index === 0 ? styles.badgeLive : styles.badgeNext]}>
                <Text style={styles.badgeText}>{event.status.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.title}>{event.name}</Text>
                <Copy style={styles.muted}>{event.subtitle}</Copy>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{event.time}</Text>
              <Text style={styles.meta}>Cổng A · 1.284 vé</Text>
            </View>
          </StaffCard>
        </Pressable>
      ))}
      <View style={styles.help}>
        <Text style={styles.helpIcon}>i</Text>
        <Text style={styles.helpText}>
          Bạn chỉ nhìn thấy các sự kiện được tổ chức phân quyền cho ca làm việc này.
        </Text>
      </View>
    </StaffFrame>
  );
}

const styles = StyleSheet.create({
  pressable: { borderRadius: 16 },
  selected: { borderColor: c.primary, borderWidth: 1.5 },
  badge: {
    position: 'absolute',
    left: 10,
    top: 10,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  badgeLive: { backgroundColor: '#237857' },
  badgeNext: { backgroundColor: '#765800' },
  badgeText: { color: 'white', fontFamily: fonts.semibold, fontSize: 9 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: c.text, fontFamily: fonts.heading, fontSize: 17 },
  muted: { color: c.muted },
  chevron: { color: c.primary, fontSize: 28 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: c.muted, fontFamily: fonts.medium, fontSize: 11 },
  help: { backgroundColor: c.blueTint, borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10 },
  helpIcon: {
    color: '#315D99',
    borderWidth: 1,
    borderColor: '#315D99',
    width: 18,
    height: 18,
    borderRadius: 9,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  helpText: { color: '#315D99', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, flex: 1 },
});
