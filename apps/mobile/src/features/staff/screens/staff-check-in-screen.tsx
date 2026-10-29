import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Field, QueryState, c, fonts } from '@/components/ui';
import { useAuth } from '../../auth/hooks/auth-context';
import { StaffCard, StaffFrame, StaffSectionTitle, StaffStatus } from '../components/staff-ui';
import { useSelectedStaffShift } from '../hooks/use-selected-staff-shift';
import { useStaffDevice } from '../hooks/use-staff-device';
import {
  manualCheckInStaff,
  searchStaffAttendees,
  type StaffAttendee,
  type StaffScanResult,
} from '../lib/staff-api';

export default function StaffCheckInScreen() {
  const { session } = useAuth();
  const { query: shiftsQuery, selected } = useSelectedStaffShift();
  const device = useStaffDevice(session?.workspace.orgId);
  const [search, setSearch] = useState('');
  const [attendees, setAttendees] = useState<StaffAttendee[]>([]);
  const [selectedAttendee, setSelectedAttendee] = useState<StaffAttendee | null>(null);
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<StaffScanResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const gateId = selected?.gate?.id;

  const searchAttendees = async () => {
    if (!selected || search.trim().length < 3) return;
    setSearching(true);
    setError(null);
    try {
      setAttendees(await searchStaffAttendees(selected.sessionId, search.trim()));
    } catch (cause) {
      setError(cause);
    } finally {
      setSearching(false);
    }
  };

  const manualCheckIn = async () => {
    if (!selected || !selectedAttendee || !gateId || !device.data?.deviceId) return;
    setChecking(true);
    setError(null);
    try {
      setResult(
        await manualCheckInStaff({
          ticketId: selectedAttendee.ticket_id,
          sessionId: selected.sessionId,
          gateId,
          deviceId: device.data.deviceId,
        }),
      );
    } catch (cause) {
      setError(cause);
    } finally {
      setChecking(false);
    }
  };

  if (shiftsQuery.isPending) {
    return (
      <StaffFrame title="Soát vé vào cổng" active="check-in">
        <QueryState loading />
      </StaffFrame>
    );
  }
  if (!selected) {
    return (
      <StaffFrame title="Soát vé vào cổng" active="check-in">
        <QueryState empty emptyText="Chưa có session được phân công." />
      </StaffFrame>
    );
  }

  return (
    <StaffFrame
      title="Soát vé vào cổng"
      subtitle={`${selected.session?.title ?? 'Session'} · ${selected.gate?.name ?? 'Chưa gán gate'}`}
      active="check-in"
    >
      <View style={styles.statusRow}>
        <StaffStatus tone={gateId && device.data ? 'success' : 'warning'}>
          {gateId && device.data ? 'Sẵn sàng check-in' : 'Thiếu gate hoặc device registration'}
        </StaffStatus>
        <Text style={styles.permission}>{selected.permissions.join(' · ')}</Text>
      </View>
      <StaffCard style={styles.qrUnavailable}>
        <View style={styles.qrIcon}>
          <Text style={styles.qrIconText}>QR</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={styles.resultTitle}>Quét QR</Text>
          <Text style={styles.resultDetail}>Native camera/QR verifier chưa được nối trong app hiện tại.</Text>
        </View>
      </StaffCard>
      <View style={{ gap: 10 }}>
        <StaffSectionTitle>Tra cứu khách để check-in thủ công</StaffSectionTitle>
        <StaffCard>
          <Field
            label="Mã booking, tên hoặc 4 số cuối điện thoại"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="characters"
            placeholder="Tối thiểu 3 ký tự"
          />
          <Button busy={searching} disabled={search.trim().length < 3} onPress={() => void searchAttendees()}>
            Tìm attendee
          </Button>
        </StaffCard>
      </View>
      {attendees.map((attendee) => (
        <Pressable
          key={attendee.ticket_id}
          onPress={() => setSelectedAttendee(attendee)}
          accessibilityRole="radio"
        >
          <StaffCard style={selectedAttendee?.ticket_id === attendee.ticket_id ? styles.selected : undefined}>
            <View style={styles.attendeeRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.resultTitle}>{attendee.name ?? 'Khách chưa có tên'}</Text>
                <Text style={styles.resultDetail}>
                  {attendee.booking_code} · {attendee.ticket_type}
                </Text>
                <Text style={styles.resultDetail}>
                  {attendee.zone_name ?? 'Không có khu'} · {attendee.seat_code ?? 'Vé đứng'} ·{' '}
                  {attendee.phone_masked ?? 'Không có SĐT'}
                </Text>
              </View>
              <Text
                style={[styles.attendeeStatus, attendee.status === 'ISSUED' ? styles.issued : styles.used]}
              >
                {attendee.status}
              </Text>
            </View>
          </StaffCard>
        </Pressable>
      ))}
      {selectedAttendee ? (
        <Button
          busy={checking}
          disabled={!gateId || !device.data?.deviceId || selectedAttendee.status !== 'ISSUED'}
          onPress={() => void manualCheckIn()}
        >
          Xác nhận giấy tờ và check-in
        </Button>
      ) : null}
      {result ? <Result result={result} /> : null}
      {error ? <QueryState error={error} /> : null}
      {!gateId ? (
        <Text style={styles.warning}>
          Assignment không có gate_id nên database sẽ từ chối thao tác check-in.
        </Text>
      ) : null}
    </StaffFrame>
  );
}

function Result({ result }: { result: StaffScanResult }) {
  const ok = result.result === 'OK';
  return (
    <StaffCard style={ok ? styles.resultGood : styles.resultBad}>
      <Text style={[styles.resultBadge, ok ? styles.issued : styles.used]}>{result.result}</Text>
      <Text style={styles.resultDetail}>
        {result.ticket?.holder_name ?? 'Database đã ghi nhận kết quả check-in.'}
      </Text>
    </StaffCard>
  );
}

const styles = StyleSheet.create({
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  permission: { color: c.muted, fontFamily: fonts.medium, fontSize: 10 },
  qrUnavailable: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.blueTint,
    borderColor: '#CBD9F0',
  },
  qrIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#315D99',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrIconText: { color: 'white', fontFamily: fonts.heading, fontSize: 15, letterSpacing: 1 },
  resultTitle: { color: c.text, fontFamily: fonts.semibold, fontSize: 14 },
  resultDetail: { color: c.muted, fontFamily: fonts.regular, fontSize: 11, lineHeight: 16 },
  selected: { borderColor: c.primary, borderWidth: 1.5, backgroundColor: c.tint },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  attendeeStatus: { fontFamily: fonts.semibold, fontSize: 10 },
  issued: { color: '#237857' },
  used: { color: c.primary },
  resultGood: { backgroundColor: '#E8F5EF', borderColor: '#B9E3CC' },
  resultBad: { backgroundColor: '#FBEAED', borderColor: '#F1C0C8' },
  resultBadge: { fontFamily: fonts.heading, fontSize: 16 },
  warning: { color: '#946018', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
});
