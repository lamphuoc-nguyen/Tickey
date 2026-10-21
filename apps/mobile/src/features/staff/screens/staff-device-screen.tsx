import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Copy, c, fonts } from '@/components/ui';
import { StaffCard, StaffFrame, StaffSectionTitle, StaffStatus } from '../components/staff-ui';

export default function StaffDeviceScreen() {
  const [registered, setRegistered] = useState(true);
  return (
    <StaffFrame title="Đăng ký thiết bị" subtitle="Thiết bị được dùng để soát vé offline" back active="more">
      <StaffStatus tone={registered ? 'success' : 'warning'}>
        {registered ? 'Thiết bị đã sẵn sàng' : 'Chưa đăng ký thiết bị'}
      </StaffStatus>
      <StaffCard style={{ alignItems: 'center', paddingVertical: 28 }}>
        <View style={[styles.deviceIcon, registered ? styles.deviceGood : styles.deviceWarn]}>
          <Text style={styles.deviceGlyph}>{registered ? '✓' : '!'}</Text>
        </View>
        <Text style={styles.heading}>{registered ? 'Thiết bị đã được đăng ký' : 'Đăng ký thiết bị mới'}</Text>
        <Copy style={[styles.center, { color: c.muted }]}>
          {registered ? 'iPhone của Minh · Cổng A' : 'Đăng ký để tải manifest và soát vé khi mất mạng.'}
        </Copy>
      </StaffCard>
      <View style={{ gap: 10 }}>
        <StaffSectionTitle>Thông tin thiết bị</StaffSectionTitle>
        <StaffCard>
          <Info label="Tên thiết bị" value="iPhone của Minh" />
          <Info label="Cổng phụ trách" value="Cổng A · Khu vực chung" />
          <Info label="Đăng ký lần cuối" value="Hôm nay, 18:42" />
          <Info label="Manifest vé" value="1.284 vé · phiên bản 12" />
        </StaffCard>
      </View>
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Lưu ý offline</Text>
        <Text style={styles.noticeText}>
          Không xoá ứng dụng hoặc đăng xuất khi đang có dữ liệu chờ đồng bộ.
        </Text>
      </View>
      <Button onPress={() => setRegistered(true)}>
        {registered ? 'Làm mới đăng ký' : 'Đăng ký thiết bị'}
      </Button>
      {registered ? (
        <Pressable
          onPress={() => setRegistered(false)}
          accessibilityRole="button"
          style={styles.dangerAction}
        >
          <Text style={styles.dangerText}>Huỷ đăng ký thiết bị</Text>
        </Pressable>
      ) : null}
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
  deviceWarn: { backgroundColor: '#FFF3D9' },
  deviceGlyph: { color: '#237857', fontFamily: fonts.heading, fontSize: 34 },
  heading: { color: c.text, fontFamily: fonts.heading, fontSize: 18, textAlign: 'center' },
  center: { textAlign: 'center', maxWidth: 260 },
  infoRow: {
    minHeight: 44,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    justifyContent: 'center',
    gap: 3,
  },
  infoLabel: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  infoValue: { color: c.text, fontFamily: fonts.semibold, fontSize: 13 },
  notice: { backgroundColor: c.amberTint, borderRadius: 12, padding: 14, gap: 4 },
  noticeTitle: { color: c.amber, fontFamily: fonts.semibold, fontSize: 12 },
  noticeText: { color: c.amber, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
  dangerAction: { alignItems: 'center', padding: 8 },
  dangerText: { color: c.primary, fontFamily: fonts.semibold, fontSize: 12 },
});
