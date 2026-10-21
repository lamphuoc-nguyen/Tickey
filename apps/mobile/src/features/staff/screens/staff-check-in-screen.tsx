import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Field, c, fonts } from '@/components/ui';
import { StaffCard, StaffFrame, StaffSectionTitle, StaffStatus } from '../components/staff-ui';

type ScanResult = 'idle' | 'valid' | 'used' | 'wrong-session' | 'invalid';

export default function StaffCheckInScreen() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<ScanResult>('idle');

  const simulateScan = () => setResult(code.toUpperCase().includes('USED') ? 'used' : 'valid');
  const verifyManual = () => setResult(code.trim().length >= 4 ? 'valid' : 'invalid');

  return (
    <StaffFrame title="Soát vé vào cổng" subtitle="Đêm 1 - Công G1 · Cổng A" active="check-in">
      <View style={styles.modeRow}>
        <StaffStatus tone="success">Online</StaffStatus>
        <Text style={styles.pending}>12 vé chờ đồng bộ</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mở camera quét mã QR"
        onPress={simulateScan}
        style={({ pressed }) => [styles.scanner, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.scanCornerTL} />
        <View style={styles.scanCornerTR} />
        <View style={styles.scanCornerBL} />
        <View style={styles.scanCornerBR} />
        <View style={styles.qrPlaceholder}>
          <Text style={styles.qrText}>QR</Text>
        </View>
        <Text style={styles.scanTitle}>Đưa mã QR vào khung</Text>
        <Text style={styles.scanCaption}>Chạm để mô phỏng quét vé</Text>
      </Pressable>
      {result !== 'idle' ? <ScanResultCard result={result} /> : null}
      <View style={{ gap: 10 }}>
        <StaffSectionTitle>Hoặc nhập mã vé</StaffSectionTitle>
        <StaffCard>
          <Field
            label="Mã vé / mã đặt chỗ"
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            placeholder="Ví dụ: TK-8F2K-1A"
            helper="Mã vé nằm dưới mã QR của khách."
          />
          <Button secondary onPress={verifyManual}>
            Kiểm tra vé
          </Button>
        </StaffCard>
      </View>
      <View style={styles.offlineNotice}>
        <Text style={styles.offlineTitle}>Soát vé offline</Text>
        <Text style={styles.offlineText}>
          Vé hợp lệ vẫn được ghi nhận khi mất kết nối. Dữ liệu sẽ tự đồng bộ khi online.
        </Text>
      </View>
    </StaffFrame>
  );
}

function ScanResultCard({ result }: { result: Exclude<ScanResult, 'idle'> }) {
  const content: Record<
    Exclude<ScanResult, 'idle'>,
    { title: string; detail: string; tone: 'success' | 'danger' | 'warning' }
  > = {
    valid: { title: 'Vé hợp lệ', detail: 'Minh Thư · Hạng vé VIP · 1 người', tone: 'success' },
    used: { title: 'Vé đã được sử dụng', detail: 'Vé này đã check-in lúc 18:56 tại Cổng A.', tone: 'danger' },
    'wrong-session': { title: 'Sai suất diễn', detail: 'Vé thuộc một suất diễn khác.', tone: 'warning' },
    invalid: {
      title: 'Không thể nhận diện vé',
      detail: 'Kiểm tra lại mã vé hoặc thử quét QR mới.',
      tone: 'danger',
    },
  };
  const item = content[result];
  return (
    <StaffCard
      style={{ ...styles.resultCard, ...(result === 'valid' ? styles.resultGood : styles.resultBad) }}
    >
      <View style={styles.resultIcon}>
        <Text style={styles.resultIconText}>{result === 'valid' ? '✓' : '!'}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.resultTitle}>{item.title}</Text>
        <Text style={styles.resultDetail}>{item.detail}</Text>
      </View>
      <Text style={styles.resultArrow}>›</Text>
    </StaffCard>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pending: { color: c.muted, fontFamily: fonts.medium, fontSize: 11 },
  scanner: {
    height: 290,
    borderRadius: 20,
    backgroundColor: '#172A35',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 8,
  },
  qrPlaceholder: {
    width: 132,
    height: 132,
    borderWidth: 2,
    borderColor: '#D9422D',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  qrText: { color: '#FFDAD3', fontFamily: fonts.heading, fontSize: 38, letterSpacing: 5 },
  scanTitle: { color: 'white', fontFamily: fonts.semibold, fontSize: 14, marginTop: 5 },
  scanCaption: { color: 'rgba(255,255,255,0.65)', fontFamily: fonts.regular, fontSize: 11 },
  scanCornerTL: {
    position: 'absolute',
    top: 56,
    left: 60,
    width: 27,
    height: 27,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#FFB6A8',
  },
  scanCornerTR: {
    position: 'absolute',
    top: 56,
    right: 60,
    width: 27,
    height: 27,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#FFB6A8',
  },
  scanCornerBL: {
    position: 'absolute',
    bottom: 58,
    left: 60,
    width: 27,
    height: 27,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#FFB6A8',
  },
  scanCornerBR: {
    position: 'absolute',
    bottom: 58,
    right: 60,
    width: 27,
    height: 27,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#FFB6A8',
  },
  resultCard: { flexDirection: 'row', alignItems: 'center' },
  resultGood: { backgroundColor: '#E8F5EF', borderColor: '#B9E3CC' },
  resultBad: { backgroundColor: '#FBEAED', borderColor: '#F1C0C8' },
  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconText: { color: '#237857', fontFamily: fonts.heading, fontSize: 23 },
  resultTitle: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  resultDetail: { color: c.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 16 },
  resultArrow: { color: c.primary, fontSize: 26 },
  offlineNotice: { backgroundColor: c.blueTint, borderRadius: 12, padding: 13, gap: 4 },
  offlineTitle: { color: '#315D99', fontFamily: fonts.semibold, fontSize: 12 },
  offlineText: { color: '#315D99', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
});
