import type { NotificationPreferences } from '@event/core';
import { Switch, View } from 'react-native';
import { AuthGate } from '@/features/auth/components/auth-gate';
import { ActionFooter, Copy, ErrorNotice, Heading, Notice, QueryState, Screen, c, ui } from '@/components/ui';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { useAccountActions, usePreferences } from '../hooks/use-customer-data';
import { useScheduleReminders } from '@/features/customer/notifications/hooks/use-reminders';
import { deviceReminderUnavailableReason } from '@/features/customer/notifications/native-notifications';
import { MenuGroup } from '@/components/customer-controls';
const rows = [
  ['reminder24h', 'Nhắc trước 24 giờ'],
  ['reminder2h', 'Nhắc trước 2 giờ'],
  ['emailEnabled', 'Email vé và đơn hàng'],
  ['pushEnabled', 'Thông báo trên thiết bị'],
] as const;
function Content() {
  const query = usePreferences(),
    { savePreferences } = useAccountActions(),
    schedule = useScheduleReminders();
  const { draft, update, clear } = useFormDraft('preferences', {
    values: {} as Partial<NotificationPreferences>,
  });
  const preferences = { ...query.data, ...draft.values };
  const ready = rows.every(([key]) => typeof preferences[key] === 'boolean');
  const busy = savePreferences.isPending || schedule.isPending;
  const deviceUnavailable = deviceReminderUnavailableReason();
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={!ready || !!query.error}
          disabledReason={
            query.error ? 'Cần tải được tùy chọn trước khi lưu.' : 'Chưa tải hoặc chọn đầy đủ tùy chọn.'
          }
          busy={busy}
          onPress={() => {
            if (ready && !query.error && !busy)
              void savePreferences
                .mutateAsync(preferences as NotificationPreferences)
                .then(async (p) => {
                  clear();
                  await schedule.mutateAsync(p);
                })
                .catch(() => {});
          }}
        >
          Lưu tùy chọn
        </ActionFooter>
      }
    >
      <Heading>Nhắc lịch & thông báo</Heading>
      <QueryState loading={query.isPending} error={query.error} retry={() => void query.refetch()} />
      <MenuGroup>
        {rows.map(([key, label]) => (
          <View
            key={key}
            style={[
              ui.row,
              { minHeight: 56, paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Copy style={ui.semibold}>{label}</Copy>
              {typeof preferences[key] !== 'boolean' && <Copy style={ui.muted}>Chưa tải được lựa chọn</Copy>}
            </View>
            <Switch
              accessibilityLabel={label}
              disabled={busy}
              value={preferences[key] ?? false}
              trackColor={{ true: c.primary, false: c.gray }}
              onValueChange={(value) => {
                savePreferences.reset();
                schedule.reset();
                update({ values: { ...draft.values, [key]: value } });
              }}
            />
          </View>
        ))}
      </MenuGroup>
      <Copy style={ui.muted}>
        {deviceUnavailable ?? 'Nhắc lịch cần quyền thông báo. Thông báo tự động chưa khả dụng.'}
      </Copy>
      {!!savePreferences.error && <ErrorNotice error={savePreferences.error} />}
      {savePreferences.isSuccess && (
        <Copy accessibilityLiveRegion="polite" style={ui.muted}>
          Đã lưu tùy chọn.
        </Copy>
      )}
      {!!schedule.error && (
        <>
          <ErrorNotice error={schedule.error} />
          <Notice warning>
            Tùy chọn đã được lưu, nhưng chưa thể cập nhật nhắc lịch trên thiết bị. Vui lòng thử lại khi có kết
            nối.
          </Notice>
        </>
      )}
      {schedule.data && <Notice>{schedule.data}</Notice>}
    </Screen>
  );
}
export default function PreferencesScreen() {
  return (
    <AuthGate>
      <Content />
    </AuthGate>
  );
}
