import { formatSessionTime, staffShiftPhase } from '@event/core';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Copy, c, fonts } from '@/components/ui';
import { StaffCard, StaffFrame, StaffStatus } from '../components/staff-ui';
import { useSelectedStaffShift } from '../hooks/use-selected-staff-shift';

export default function StaffEventScreen() {
  const { query, shifts, selected, now } = useSelectedStaffShift();
  return (
    <StaffFrame title="Chọn ca làm việc" subtitle="Chỉ hiển thị assignment còn hiệu lực của bạn" back>
      <StaffStatus tone={query.isError ? 'danger' : 'info'}>
        {query.isError ? 'Không thể tải assignment từ server' : `${shifts.length} assignment đang khả dụng`}
      </StaffStatus>
      {query.isPending ? <Text style={styles.muted}>Đang tải ca làm việc…</Text> : null}
      {shifts.map((shift) => {
        const active = shift.id === selected?.id;
        const phase = staffShiftPhase(shift, now);
        const title = shift.session?.title ?? 'Suất diễn';
        const event = shift.session?.event?.title;
        return (
          <Pressable
            key={shift.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() =>
              router.replace({
                pathname: '/staff',
                params: { sessionId: shift.sessionId, assignmentId: shift.id },
              })
            }
          >
            <StaffCard style={active ? styles.selected : undefined}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.title}>{title}</Text>
                  {event ? <Copy style={styles.muted}>{event}</Copy> : null}
                </View>
                <Text style={styles.chevron}>›</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>
                  {shift.session
                    ? formatSessionTime(shift.session.startsAt, shift.session.venue?.timezone)
                    : 'Chưa có suất'}
                </Text>
                <Text style={styles.meta}>{shift.gate?.name ?? 'Mọi cổng'}</Text>
              </View>
              <Text style={[styles.phase, phase === 'ACTIVE' && styles.phaseActive]}>
                {phase === 'ACTIVE' ? 'Đang trong ca' : `Bắt đầu ${formatSessionTime(shift.validFrom)}`}
                {' · '}
                {shift.permissions.join(', ')}
              </Text>
            </StaffCard>
          </Pressable>
        );
      })}
      {!query.isPending && !shifts.length ? (
        <StaffCard>
          <Text style={styles.title}>Chưa có assignment</Text>
          <Copy style={styles.muted}>
            Người quản lý cần phân công session, gate và permission cho tài khoản này.
          </Copy>
        </StaffCard>
      ) : null}
    </StaffFrame>
  );
}

const styles = StyleSheet.create({
  selected: { borderColor: c.primary, borderWidth: 1.5, backgroundColor: c.tint },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: c.text, fontFamily: fonts.heading, fontSize: 17 },
  muted: { color: c.muted },
  chevron: { color: c.primary, fontSize: 28 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { color: c.muted, fontFamily: fonts.medium, fontSize: 11 },
  phase: { color: c.muted, fontFamily: fonts.regular, fontSize: 11 },
  phaseActive: { color: '#237857', fontFamily: fonts.semibold },
});
