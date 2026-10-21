import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../auth/hooks/auth-context';
import { Copy, c, fonts } from '@/components/ui';
import {
  EventImage,
  StaffAction,
  StaffCard,
  StaffFrame,
  StaffSectionTitle,
  StaffStatus,
} from '../components/staff-ui';

const roleLabels: Record<string, string> = {
  SCANNER: 'Soát vé',
  POS: 'Bán vé POS',
  GATE_MANAGER: 'Quản lý cổng',
};

export default function StaffHomeScreen() {
  const { session } = useAuth();
  const roles =
    session?.workspace.roles
      .filter((role: string) => roleLabels[role])
      .map((role: string) => roleLabels[role]) ?? [];
  const displayName = session?.email?.split('@')[0] ?? 'nhân viên';

  return (
    <StaffFrame title="Ca làm việc" subtitle={`Xin chào, ${displayName}`}>
      <View style={styles.welcomeRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.role}>{roles.length ? roles.join(' · ') : 'Nhân viên sự kiện'}</Text>
        </View>
        <Pressable onPress={() => router.push('/staff/workspaces')} accessibilityRole="button">
          <Text style={styles.change}>Đổi tổ chức</Text>
        </Pressable>
      </View>

      <StaffStatus tone="success">Thiết bị đang online · Dữ liệu được đồng bộ</StaffStatus>

      <View style={{ gap: 10 }}>
        <StaffSectionTitle action="Đổi sự kiện" onAction={() => router.push('/staff/event')}>
          Sự kiện đang chọn
        </StaffSectionTitle>
        <StaffCard>
          <View style={styles.eventImageWrap}>
            <EventImage />
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>ĐANG DIỄN RA</Text>
            </View>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={styles.eventTitle}>Đêm 1 - Công G1</Text>
            <Copy style={{ color: c.muted }}>Live Music Festival · 19:00 hôm nay</Copy>
          </View>
          <View style={styles.eventMetaRow}>
            <Text style={styles.eventMeta}>Cổng A · Khu vực chung</Text>
            <Text style={styles.eventMeta}>1.284 vé</Text>
          </View>
        </StaffCard>
      </View>

      <View style={{ gap: 10 }}>
        <StaffSectionTitle>Thao tác nhanh</StaffSectionTitle>
        <StaffAction
          label="Soát vé vào cổng"
          caption="Quét QR hoặc nhập mã vé"
          icon="ticket"
          onPress={() => router.push('/staff/check-in')}
        />
        <StaffAction
          label="Bán vé tại quầy"
          caption="POS · tạo đơn và thanh toán"
          icon="calendar"
          tone="soft"
          onPress={() => router.push('/staff/pos')}
        />
      </View>

      <View style={{ gap: 10 }}>
        <StaffSectionTitle action="Xem chi tiết" onAction={() => router.push('/staff/tickets')}>
          Tổng quan ca
        </StaffSectionTitle>
        <View style={styles.metricsRow}>
          <Metric value="128" label="Đã check-in" tone="green" />
          <Metric value="64" label="Vé phát hành" tone="red" />
          <Metric value="12" label="Chờ đồng bộ" tone="amber" />
        </View>
      </View>

      <StaffCard style={{ backgroundColor: '#FFF3D9', borderColor: '#F3D79B' }}>
        <View style={styles.deviceHeader}>
          <View style={styles.smallIconCircle}>
            <Text style={styles.smallIcon}>⌁</Text>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.deviceTitle}>Thiết bị đã đăng ký</Text>
            <Text style={styles.deviceCaption}>iPhone của Minh · Cổng A</Text>
          </View>
          <Text style={styles.deviceCheck}>✓</Text>
        </View>
        <Text style={styles.deviceHint}>Bạn có thể tiếp tục soát vé ngay cả khi mất mạng.</Text>
        <Pressable onPress={() => router.push('/staff/device')} accessibilityRole="button">
          <Text style={styles.deviceLink}>Quản lý thiết bị ›</Text>
        </Pressable>
      </StaffCard>
    </StaffFrame>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone: 'green' | 'red' | 'amber' }) {
  const colors = { green: '#1B7956', red: c.primary, amber: '#946018' };
  return (
    <View style={[styles.metric, { borderTopColor: colors[tone] }]}>
      <Text style={[styles.metricValue, { color: colors[tone] }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: c.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: c.primary, fontFamily: fonts.heading, fontSize: 19 },
  name: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  role: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  change: { color: c.primary, fontFamily: fonts.semibold, fontSize: 11 },
  eventImageWrap: { position: 'relative' },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(27,121,86,0.92)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#B9F0D6' },
  liveText: { color: 'white', fontFamily: fonts.semibold, fontSize: 9 },
  eventTitle: { color: c.text, fontFamily: fonts.heading, fontSize: 18 },
  eventMetaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 },
  eventMeta: { color: c.muted, fontFamily: fonts.medium, fontSize: 11 },
  metricsRow: { flexDirection: 'row', gap: 8 },
  metric: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderTopWidth: 3,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  metricValue: { fontFamily: fonts.heading, fontSize: 22 },
  metricLabel: { color: c.muted, fontFamily: fonts.regular, fontSize: 10, lineHeight: 14 },
  deviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  smallIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFDF7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallIcon: { color: '#946018', fontSize: 22 },
  deviceTitle: { color: c.text, fontFamily: fonts.semibold, fontSize: 13 },
  deviceCaption: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  deviceCheck: { color: '#237857', fontFamily: fonts.heading, fontSize: 20 },
  deviceHint: { color: '#765800', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
  deviceLink: { color: '#946018', fontFamily: fonts.semibold, fontSize: 11 },
});
