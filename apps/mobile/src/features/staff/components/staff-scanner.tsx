import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Crypto from 'expo-crypto';
import { ApiError } from '@event/core';
import { Button, Field, QueryState, c, fonts } from '@/components/ui';
import { StaffCard } from './staff-ui';
import { scanStaffCode, type StaffScanResult } from '../lib/staff-api';

const MAX_PER_SCAN = 20;

const resultText: Record<string, string> = {
  OK: 'Cho vào',
  ALREADY_USED: 'Mã đã dùng hết lượt',
  WRONG_ZONE: 'Sai cổng',
  WRONG_SESSION: 'Không phải suất diễn này',
  OUTSIDE_TIME: 'Ngoài giờ mở cổng',
  REVOKED: 'Vé đã bị thu hồi',
  INVALID_SIGNATURE: 'Mã QR không hợp lệ',
};

/**
 * Scan a booking QR (one code for the whole group) or a ticket QR. The camera only fills the code; staff then
 * choose how many people walk in and confirm, so a camera that keeps reading the same code never uses up entries.
 */
export function StaffScanner({
  sessionId,
  gateId,
  deviceId,
}: {
  sessionId: string;
  gateId?: string;
  deviceId?: string;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOn, setCameraOn] = useState(false);
  const [code, setCode] = useState('');
  const [count, setCount] = useState(1);
  // One id per intended admission: a retry after a lost response replays it instead of letting in more people.
  const [attemptId, setAttemptId] = useState(() => Crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<StaffScanResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const ready = !!gateId && !!deviceId;

  const changeCode = (value: string) => {
    setCode(value.trim());
    setCount(1);
    setResult(null);
    setError(null);
    setAttemptId(Crypto.randomUUID());
  };
  const changeCount = (value: number) => {
    setCount(Math.min(MAX_PER_SCAN, Math.max(1, value)));
    setAttemptId(Crypto.randomUUID());
  };

  const submit = async () => {
    if (!ready || !code) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await scanStaffCode({ code, sessionId, gateId, deviceId, clientScanId: attemptId, count }));
      setAttemptId(Crypto.randomUUID());
    } catch (cause) {
      setError(cause);
    } finally {
      setBusy(false);
    }
  };

  const remainingLimit =
    error instanceof ApiError &&
    error.code === 'VALIDATION_FAILED' &&
    typeof error.details.remaining === 'number'
      ? error.details.remaining
      : null;

  return (
    <View style={{ gap: 10 }}>
      <StaffCard style={{ gap: 12 }}>
        <Text style={styles.title}>Quét QR vào cổng</Text>
        {cameraOn && permission?.granted ? (
          <View style={styles.camera}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                setCameraOn(false);
                changeCode(data);
              }}
            />
          </View>
        ) : (
          <Button
            secondary
            onPress={() =>
              void (permission?.granted ? Promise.resolve(permission) : requestPermission()).then((p) =>
                setCameraOn(p.granted),
              )
            }
          >
            {permission && !permission.granted && !permission.canAskAgain
              ? 'Camera bị chặn: mở Cài đặt để cho phép'
              : 'Mở camera quét mã'}
          </Button>
        )}
        <Field
          label="Mã QR (hoặc dán mã khi không quét được)"
          value={code}
          onChangeText={changeCode}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Quét hoặc dán mã"
        />
        <View style={styles.countRow}>
          <Text style={styles.detail}>Số người vào lượt này</Text>
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bớt một người"
              onPress={() => changeCount(count - 1)}
              style={styles.step}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.count} accessibilityLabel={`${count} người`}>
              {count}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Thêm một người"
              onPress={() => changeCount(count + 1)}
              style={styles.step}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        </View>
        <Button
          busy={busy}
          disabled={!ready || !code}
          disabledReason={ready ? 'Quét hoặc nhập mã trước.' : 'Cần gate và thiết bị đã đăng ký.'}
          onPress={() => void submit()}
        >
          {`Cho vào ${count} người`}
        </Button>
      </StaffCard>
      {result ? <ScanResult result={result} /> : null}
      {remainingLimit !== null ? (
        <StaffCard style={styles.bad}>
          <Text style={styles.title}>Đơn chỉ còn {remainingLimit} lượt</Text>
          <Text style={styles.detail}>Giảm số người rồi xác nhận lại.</Text>
        </StaffCard>
      ) : error ? (
        <QueryState error={error} />
      ) : null}
    </View>
  );
}

function ScanResult({ result }: { result: StaffScanResult }) {
  const ok = result.result === 'OK';
  const admitted = result.admitted?.length ?? (ok && result.ticket ? 1 : 0);
  return (
    <StaffCard style={ok ? styles.good : styles.bad}>
      <Text style={[styles.badge, { color: ok ? '#237857' : c.primary }]}>
        {ok ? `Cho vào ${admitted} người` : (resultText[result.result] ?? result.result)}
        {result.replayed ? ' (đã ghi trước đó)' : ''}
      </Text>
      {result.booking_code ? (
        <Text style={styles.detail}>
          Đơn {result.booking_code}
          {result.holder_name ? ` · ${result.holder_name}` : ''}
        </Text>
      ) : null}
      {result.total !== undefined ? (
        <Text style={styles.detail}>
          Đã vào {result.used}/{result.total} · Còn {result.remaining} lượt
        </Text>
      ) : null}
      {(result.admitted ?? (result.ticket ? [result.ticket] : [])).map((t) => (
        <Text key={t.id} style={styles.detail}>
          {t.seat_code ?? 'Vé đứng'} · {t.zone_name ?? 'Không có khu'} · {t.ticket_type ?? ''}
        </Text>
      ))}
      {result.allowed_gates?.length ? (
        <Text style={styles.detail}>Đúng cổng: {result.allowed_gates.map((g) => g.name).join(', ')}</Text>
      ) : null}
    </StaffCard>
  );
}

const styles = StyleSheet.create({
  title: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  detail: { color: c.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  camera: { height: 260, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: c.text, fontFamily: fonts.semibold, fontSize: 20 },
  count: { minWidth: 28, textAlign: 'center', color: c.text, fontFamily: fonts.heading, fontSize: 20 },
  badge: { fontFamily: fonts.heading, fontSize: 16 },
  good: { backgroundColor: '#E8F5EF', borderColor: '#B9E3CC' },
  bad: { backgroundColor: '#FBEAED', borderColor: '#F1C0C8' },
});
