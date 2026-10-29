import { useQuery } from '@tanstack/react-query';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Copy, c, fonts } from '@/components/ui';
import { useAuth } from '../../auth/hooks/auth-context';
import { StaffCard, StaffFrame, StaffSectionTitle, StaffStatus } from '../components/staff-ui';
import { getStaffManifest } from '../lib/staff-api';
import { useStaffDevice } from '../hooks/use-staff-device';
import { useSelectedStaffShift } from '../hooks/use-selected-staff-shift';

export default function StaffDeviceScreen() {
  const { session } = useAuth();
  const orgId = session?.workspace.orgId;
  const device = useStaffDevice(orgId);
  const { selected } = useSelectedStaffShift();
  const manifest = useQuery({
    queryKey: ['staff-manifest', selected?.sessionId, device.data?.deviceId],
    queryFn: () => getStaffManifest(selected!.sessionId, device.data!.deviceId),
    enabled: !!selected?.sessionId && !!device.data?.deviceId,
  });
  const failed = device.isError;
  return (
    <StaffFrame
      title="Thiết bị soát vé"
      subtitle="Device registration và manifest đều lấy từ server"
      back
      active="more"
    >
      <StaffStatus tone={failed ? 'danger' : device.isPending ? 'warning' : 'success'}>
        {failed
          ? 'Đăng ký thiết bị thất bại'
          : device.isPending
            ? 'Đang đăng ký thiết bị…'
            : 'Thiết bị đã sẵn sàng'}
      </StaffStatus>
      <StaffCard style={{ alignItems: 'center', paddingVertical: 28 }}>
        <View style={[styles.deviceIcon, failed ? styles.deviceWarn : styles.deviceGood]}>
          <Text style={styles.deviceGlyph}>{failed ? '!' : device.isPending ? '…' : '✓'}</Text>
        </View>
        <Text style={styles.heading}>{device.data?.name ?? 'Thiết bị Staff'}</Text>
        <Copy style={styles.center}>
          {device.data?.deviceId
            ? `Device ID: ${device.data.deviceId}`
            : 'Mỗi org có một device registration riêng.'}
        </Copy>
      </StaffCard>
      <View style={{ gap: 10 }}>
        <StaffSectionTitle>Manifest session</StaffSectionTitle>
        <StaffCard>
          <Info label="Session đang chọn" value={selected?.session?.title ?? 'Chưa chọn session'} />
          <Info
            label="Số vé trong manifest"
            value={manifest.data ? String(manifest.data.tickets.length) : 'Chưa tải'}
          />
          <Info label="Server time" value={manifest.data?.server_now ?? 'Chưa tải'} />
          <Info
            label="Public keys"
            value={manifest.data ? String(manifest.data.public_keys.length) : 'Chưa tải'}
          />
          {manifest.isError ? (
            <Text style={styles.error}>
              Không thể tải manifest. Kiểm tra assignment SCAN và device status.
            </Text>
          ) : null}
        </StaffCard>
      </View>
      {device.isError ? <Button onPress={() => void device.refetch()}>Đăng ký lại thiết bị</Button> : null}
      <Copy style={styles.note}>
        Không lưu service key hoặc secret trên thiết bị. Device bị revoke phải được xoá local data và đăng ký
        lại theo quyền server.
      </Copy>
    </StaffFrame>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  deviceIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  deviceGood: { backgroundColor: '#E8F5EF' },
  deviceWarn: { backgroundColor: '#FBEAED' },
  deviceGlyph: { color: '#237857', fontFamily: fonts.heading, fontSize: 34 },
  heading: { color: c.text, fontFamily: fonts.heading, fontSize: 18, textAlign: 'center' },
  center: { textAlign: 'center', color: c.muted, maxWidth: 280 },
  infoRow: {
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    justifyContent: 'center',
    gap: 3,
  },
  infoLabel: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  infoValue: { color: c.text, fontFamily: fonts.semibold, fontSize: 13 },
  error: { color: c.primary, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
  note: { color: c.muted, fontSize: 11, lineHeight: 17 },
});
