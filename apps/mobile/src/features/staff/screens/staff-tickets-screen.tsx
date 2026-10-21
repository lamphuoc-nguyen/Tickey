import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { c, fonts } from '@/components/ui';
import { StaffCard, StaffFrame, StaffSectionTitle, StaffStatus } from '../components/staff-ui';

export default function StaffTicketsScreen() {
  return (
    <StaffFrame title="Vé và đồng bộ" subtitle="Theo dõi vé đã phát hành trong ca" active="more">
      <View style={styles.statsRow}>
        <Stat value="64" label="Đã phát hành" />
        <Stat value="12" label="Chờ đồng bộ" tone="warning" />
        <Stat value="52" label="Đã đồng bộ" tone="success" />
      </View>
      <StaffStatus tone="warning">12 bản ghi offline chưa đồng bộ</StaffStatus>
      <StaffCard style={styles.qrCard}>
        <View style={styles.qrBox}>
          <Text style={styles.qrText}>TK</Text>
          <Text style={styles.qrSmall}>8F2K 1A</Text>
        </View>
        <Text style={styles.qrTitle}>Vé POS đã phát hành</Text>
        <Text style={styles.qrMeta}>Đêm 1 - Công G1 · Hạng VIP</Text>
        <Text style={styles.qrMeta}>Mã vé TK-8F2K-1A</Text>
        <Pressable
          onPress={() => router.push('/staff/check-in')}
          accessibilityRole="button"
          style={styles.outlineButton}
        >
          <Text style={styles.outlineText}>Mở màn hình soát vé</Text>
        </Pressable>
      </StaffCard>
      <View style={{ gap: 10 }}>
        <StaffSectionTitle action="Đồng bộ ngay" onAction={() => {}}>
          Lịch sử đồng bộ
        </StaffSectionTitle>
        {[
          ['18:42', 'Đã phát hành 4 vé', 'Đã đồng bộ'],
          ['18:35', 'Đã check-in 12 vé', 'Đã đồng bộ'],
          ['18:20', 'Đã phát hành 8 vé offline', 'Chờ đồng bộ'],
        ].map(([time, title, status]) => (
          <StaffCard key={time} style={styles.historyCard}>
            <View style={styles.time}>
              <Text style={styles.timeText}>{time}</Text>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={styles.historyTitle}>{title}</Text>
              <Text style={styles.historyMeta}>Thiết bị iPhone của Minh</Text>
            </View>
            <Text style={[styles.historyStatus, status === 'Chờ đồng bộ' && { color: '#946018' }]}>
              {status}
            </Text>
          </StaffCard>
        ))}
      </View>
      <Pressable
        onPress={() => router.push('/staff/device')}
        accessibilityRole="button"
        style={styles.deviceLink}
      >
        <Text style={styles.deviceLinkText}>Quản lý thiết bị ›</Text>
      </Pressable>
    </StaffFrame>
  );
}

function Stat({
  value,
  label,
  tone = 'normal',
}: {
  value: string;
  label: string;
  tone?: 'normal' | 'warning' | 'success';
}) {
  const color = tone === 'warning' ? '#946018' : tone === 'success' ? '#237857' : c.primary;
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  statValue: { fontFamily: fonts.heading, fontSize: 22 },
  statLabel: { color: c.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 14 },
  qrCard: { alignItems: 'center', backgroundColor: '#FFF8F6' },
  qrBox: {
    width: 146,
    height: 146,
    borderRadius: 10,
    borderWidth: 9,
    borderColor: c.text,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  qrText: { color: c.text, fontFamily: fonts.heading, fontSize: 39, letterSpacing: 5 },
  qrSmall: { color: c.text, fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2 },
  qrTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 17, marginTop: 4 },
  qrMeta: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  outlineButton: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 4,
  },
  outlineText: { color: c.primary, fontFamily: fonts.semibold, fontSize: 12 },
  historyCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  time: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.container,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: { color: c.primary, fontFamily: fonts.semibold, fontSize: 11 },
  historyTitle: { color: c.text, fontFamily: fonts.semibold, fontSize: 12 },
  historyMeta: { color: c.muted, fontFamily: fonts.regular, fontSize: 10 },
  historyStatus: { color: '#237857', fontFamily: fonts.semibold, fontSize: 10 },
  deviceLink: { alignItems: 'center', padding: 8 },
  deviceLinkText: { color: c.primary, fontFamily: fonts.semibold, fontSize: 12 },
});
