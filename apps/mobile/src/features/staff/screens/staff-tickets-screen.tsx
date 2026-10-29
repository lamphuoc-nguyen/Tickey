import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { QueryState, c, fonts } from '@/components/ui';
import { useAuth } from '../../auth/hooks/auth-context';
import { StaffCard, StaffFrame, StaffSectionTitle, StaffStatus } from '../components/staff-ui';
import { useSelectedStaffShift } from '../hooks/use-selected-staff-shift';
import { useStaffDevice } from '../hooks/use-staff-device';
import { getStaffAnalytics, getStaffManifest } from '../lib/staff-api';

export default function StaffTicketsScreen() {
  const { session } = useAuth();
  const { selected, query: shiftsQuery } = useSelectedStaffShift();
  const device = useStaffDevice(session?.workspace.orgId);
  const analytics = useQuery({
    queryKey: ['staff-analytics', selected?.sessionId],
    queryFn: () => getStaffAnalytics(selected!.sessionId),
    enabled: !!selected?.sessionId && selected.permissions.includes('VIEW_ANALYTICS'),
    refetchInterval: 30_000,
  });
  const manifest = useQuery({
    queryKey: ['staff-manifest', selected?.sessionId, device.data?.deviceId],
    queryFn: () => getStaffManifest(selected!.sessionId, device.data!.deviceId),
    enabled: !!selected?.sessionId && !!device.data?.deviceId,
  });

  if (shiftsQuery.isPending)
    return (
      <StaffFrame title="Vé và đồng bộ" active="more">
        <QueryState loading />
      </StaffFrame>
    );
  if (!selected)
    return (
      <StaffFrame title="Vé và đồng bộ" active="more">
        <QueryState empty emptyText="Chưa có session được phân công." />
      </StaffFrame>
    );
  return (
    <StaffFrame
      title="Vé và đồng bộ"
      subtitle="Số liệu lấy từ gate analytics và session manifest"
      active="more"
    >
      <StaffStatus tone={analytics.isError ? 'danger' : 'success'}>
        {analytics.isError ? 'Không có quyền hoặc không tải được analytics' : 'Đã đồng bộ dữ liệu server'}
      </StaffStatus>
      {analytics.data ? (
        <View style={styles.statsRow}>
          <Stat value={analytics.data.checked_in} label="Đã check-in" />
          <Stat value={analytics.data.tickets_valid} label="Vé hợp lệ" tone="success" />
          <Stat value={analytics.data.last_15_min} label="15 phút qua" tone="warning" />
        </View>
      ) : null}
      <View style={{ gap: 10 }}>
        <StaffSectionTitle>Session manifest</StaffSectionTitle>
        <StaffCard>
          <Info label="Session" value={selected.session?.title ?? selected.sessionId} />
          <Info label="Vé tải về" value={manifest.data ? String(manifest.data.tickets.length) : 'Chưa tải'} />
          <Info
            label="Vé bị revoke"
            value={manifest.data ? String(manifest.data.revoked_ticket_ids.length) : 'Chưa tải'}
          />
          <Info label="Server time" value={manifest.data?.server_now ?? 'Chưa tải'} />
          {manifest.error ? (
            <Text style={styles.warning}>Không tải được manifest. Kiểm tra device và permission SCAN.</Text>
          ) : null}
        </StaffCard>
      </View>
      {analytics.data ? (
        <StaffCard>
          <Text style={styles.sectionTitle}>Rejections</Text>
          {Object.entries(analytics.data.rejections).length ? (
            Object.entries(analytics.data.rejections).map(([key, value]) => (
              <View style={styles.row} key={key}>
                <Text style={styles.label}>{key}</Text>
                <Text style={styles.value}>{String(value)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.label}>Chưa có rejection.</Text>
          )}
        </StaffCard>
      ) : null}
      <Pressable
        onPress={() => router.push('/staff/device')}
        accessibilityRole="button"
        style={styles.deviceLink}
      >
        <Text style={styles.deviceLinkText}>Quản lý device ›</Text>
      </Pressable>
    </StaffFrame>
  );
}

function Stat({
  value,
  label,
  tone = 'normal',
}: {
  value: number;
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
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
  sectionTitle: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  row: {
    minHeight: 38,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: { color: c.muted, fontFamily: fonts.regular, fontSize: 11, flex: 1 },
  value: { color: c.text, fontFamily: fonts.semibold, fontSize: 12, textAlign: 'right', maxWidth: '70%' },
  warning: { color: '#946018', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
  deviceLink: { alignItems: 'center', padding: 8 },
  deviceLinkText: { color: c.primary, fontFamily: fonts.semibold, fontSize: 12 },
});
