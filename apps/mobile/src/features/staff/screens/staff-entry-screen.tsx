import { formatSessionTime, staffShiftPhase, type StaffAssignment } from '@event/core';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import { Button, Copy, ErrorNotice, Heading, Notice, QueryState, Screen, c, fonts, ui } from '@/components/ui';
import { useAuth } from '../../auth/hooks/auth-context';
import { useAuthActions } from '../../auth/hooks/use-auth-actions';
import { useStaffShifts } from '../hooks/use-staff-shifts';
import StaffHomeScreen from './staff-home-screen';

const staffRoleNames: Record<string, string> = {
  SCANNER: 'Kiểm soát vé',
  POS: 'Bán vé tại quầy',
  GATE_MANAGER: 'Quản lý cổng',
};
const permissionNames: Record<string, string> = {
  SCAN: 'Quét vé',
  MANUAL_CHECKIN: 'Check-in thủ công',
  POS: 'Bán vé POS',
  VIEW_ANALYTICS: 'Lưu lượng cổng',
};

const sessionName = (shift: StaffAssignment) => shift.session?.title ?? 'Suất diễn';
const gateName = (shift: StaffAssignment) => shift.gate?.name ?? 'Mọi cổng';
// Times are shown in the venue's timezone, like the Customer screens.
const shiftTime = (shift: StaffAssignment, date: string) =>
  formatSessionTime(date, shift.session?.venue?.timezone);

/** Staff landing (Figma s-sessions 1:2699, empty state s-no-assignment 149:1424). */
function StaffLanding() {
  const { session } = useAuth();
  const actions = useAuthActions();
  const { query, shifts, now } = useStaffShifts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const organization = actions.workspaces.data?.find(
    (workspace) => workspace.kind === 'STAFF' && workspace.orgId === session?.workspace.orgId,
  );
  const roles = session?.workspace.roles.filter((role) => staffRoleNames[role]) ?? [];
  const selected = shifts.find((shift) => shift.id === selectedId) ?? shifts[0];
  const unassigned = query.isSuccess && !shifts.length;
  return (
    <Screen
      back={false}
      navigationEnabled={false}
      label="TICKEY / STAFF"
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void Promise.all([query.refetch(), actions.workspaces.refetch()])}
        />
      }
      footer={
        selected && (
          <>
            <Button
              disabled
              disabledReason="Chuẩn bị soát vé trên thiết bị chưa khả dụng. Liên hệ người quản lý nếu cần hỗ trợ."
              onPress={() => {}}
            >
              Mở {sessionName(selected)}
            </Button>
            <Copy style={{ textAlign: 'center', fontFamily: fonts.medium, fontSize: 10, color: c.muted, lineHeight: 15 }}>
              {selected.session?.venue?.name ?? organization?.orgName ?? 'Tổ chức'} · {gateName(selected)}
            </Copy>
          </>
        )
      }
    >
      <Heading>{unassigned ? 'Chưa có ca làm' : 'Ca làm của bạn'}</Heading>
      <Copy style={ui.muted}>
        {[organization?.orgName, roles.map((role) => staffRoleNames[role]).join(' · ')]
          .filter(Boolean)
          .join(' · ') || session?.email}
      </Copy>
      <QueryState
        compact
        loading={actions.workspaces.isPending}
        error={actions.workspaces.error}
        retry={() => void actions.workspaces.refetch()}
        empty={actions.workspaces.isSuccess && !organization}
        emptyText="Chưa thể xác nhận tổ chức đang phân quyền. Vui lòng chọn lại tổ chức làm việc."
      />
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      {unassigned && (
        <>
          <Notice>
            Bạn đã tham gia {organization?.orgName ?? 'tổ chức'}. Chờ tổ chức phân công suất, cổng và quyền.
            Việc có tài khoản không tự cấp quyền quét hoặc bán vé.
          </Notice>
          <Copy style={ui.semibold}>Chưa phân công</Copy>
          <Button busy={query.isRefetching} onPress={() => void query.refetch()}>
            Cập nhật phân công
          </Button>
        </>
      )}
      {shifts.map((shift) => {
        const active = shift.id === selected?.id;
        const phase = staffShiftPhase(shift, now);
        const cover = shift.session?.event?.coverImageUrl;
        return (
          <Pressable
            key={shift.id}
            accessibilityRole="radio"
            accessibilityLabel={`${sessionName(shift)}, ${shift.session?.event?.title ?? ''}, ${gateName(shift)}`}
            accessibilityState={{ checked: active }}
            onPress={() => setSelectedId(shift.id)}
            style={[
              ui.card,
              { padding: 8, backgroundColor: active ? c.tint : c.surface, borderColor: active ? c.accent : c.border },
            ]}
          >
            {cover ? (
              <Image
                source={cover}
                contentFit="cover"
                style={{ height: 90, width: '100%', borderRadius: 12 }}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={{ height: 90, borderRadius: 12, backgroundColor: c.tint }} />
            )}
            <View style={{ paddingHorizontal: 8, paddingBottom: 8, gap: 4 }}>
              <Copy style={ui.semibold}>
                {sessionName(shift)}
                {shift.session?.event?.title ? ` • ${shift.session.event.title}` : ''}
              </Copy>
              <Copy style={[ui.muted, { fontSize: 12 }]}>
                {shift.session ? `${shiftTime(shift, shift.session.startsAt)} • ` : ''}
                {gateName(shift)}
              </Copy>
              <Copy style={{ fontSize: 11, color: phase === 'ACTIVE' ? c.accent : c.muted }}>
                {phase === 'ACTIVE'
                  ? 'Đang trong ca'
                  : `Ca bắt đầu ${shiftTime(shift, shift.validFrom)}`}
                {' · '}
                {shift.permissions.map((permission) => permissionNames[permission] ?? permission).join(', ')}
              </Copy>
            </View>
          </Pressable>
        );
      })}
      <Button secondary onPress={() => router.push('/staff/workspaces')}>
        Đổi tổ chức làm việc
      </Button>
      <Button
        secondary
        busy={actions.logout.isPending}
        onPress={() =>
          void actions.logout
            .mutateAsync()
            .then(() => router.replace('/auth/login'))
            .catch(() => {})
        }
      >
        Đăng xuất
      </Button>
      {!!actions.logout.error && <ErrorNotice error={actions.logout.error} />}
    </Screen>
  );
}

export default function StaffEntryScreen() {
  // The local-only visual preview (see StaffGate) shows the demo dashboard instead of live shifts.
  return process.env.EXPO_PUBLIC_STAFF_DEMO === 'true' ? <StaffHomeScreen /> : <StaffLanding />;
}
