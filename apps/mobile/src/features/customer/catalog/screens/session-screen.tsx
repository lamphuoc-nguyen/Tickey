import { formatSessionTime } from '@event/core';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ActionFooter, Copy, Heading, QueryState, Screen, c, ui } from '@/components/ui';
import { Disclosure, TextAction } from '@/components/customer-controls';
import { useSessions } from '../hooks/use-catalog';
import { useBookingDraft } from '@/features/customer/booking/draft-store';
import { useFormDraft } from '@/features/forms/use-form-draft';
import { sessionChoices } from '../catalog-presentation';
import { usePaymentAvailability } from '@/features/customer/payment/hooks/use-payment-availability';

export default function SessionScreen() {
  const { eventId = '' } = useLocalSearchParams<{ eventId: string }>();
  const query = useSessions(eventId);
  const choices = sessionChoices(query.data ?? []);
  const paymentAvailable = usePaymentAvailability();
  const { draft, update } = useFormDraft(`sessions:${eventId}`, { selectedId: null as string | null });
  const selectedId = draft.selectedId;
  const select = (selectedId: string) => update({ selectedId });
  const pending = useBookingDraft((s) => s.unresolved);
  const pendingSession = useBookingDraft((s) => s.sessionId);
  const firstAvailable = choices.available[0];
  const selected = query.data?.find((s) => s.id === (selectedId ?? firstAvailable?.id));
  const canContinue =
    !query.error &&
    selected?.status === 'ON_SALE' &&
    !selected.salesPaused &&
    (!pending || pendingSession === selected.id);
  return (
    <Screen
      footer={
        <ActionFooter
          disabled={!canContinue}
          disabledReason={
            pending
              ? 'Kiểm tra kết quả đặt vé trước khi chọn một suất khác.'
              : query.error
                ? 'Chưa tải được suất diễn. Vui lòng thử lại.'
                : !selected
                  ? choices.available.length
                    ? 'Chọn ngày và giờ để tiếp tục.'
                    : 'Chưa có lịch diễn đang bán.'
                  : 'Suất diễn này hiện không bán vé.'
          }
          onPress={() => {
            if (!selected) return;
            useBookingDraft.getState().chooseSession(selected.id, eventId);
            router.push({
              pathname: '/sessions/[sessionId]/select',
              params: { sessionId: selected.id, eventId },
            });
          }}
        >
          Chọn vé
        </ActionFooter>
      }
    >
      <Heading>Chọn ngày và giờ</Heading>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !query.data?.length}
        emptyText="Sự kiện chưa có suất diễn."
      />
      {!paymentAvailable && !!choices.available.length && (
        <Copy style={[ui.muted, { fontSize: 12 }]}>Thanh toán vé trả phí hiện chưa khả dụng.</Copy>
      )}
      {choices.available.map((s) => {
        const active = s.id === selected?.id;
        return (
          <View key={s.id} style={{ gap: 8 }}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={`${s.title ?? 'Lịch diễn'}, ${formatSessionTime(s.startsAt, s.venue?.timezone)}`}
              accessibilityState={{ checked: active }}
              key={s.id}
              onPress={() => select(s.id)}
              style={[
                ui.card,
                {
                  backgroundColor: active ? c.tint : 'white',
                  borderColor: active ? c.accent : c.border,
                  borderWidth: active ? 2 : 1,
                },
              ]}
            >
              <Copy style={ui.semibold}>{formatSessionTime(s.startsAt, s.venue?.timezone)}</Copy>
              {s.title && <Copy>{s.title}</Copy>}
              <Copy style={ui.muted}>
                {[s.venue?.name, s.venue?.city].filter(Boolean).join(' · ') || 'Chưa có địa điểm'}
              </Copy>
              <Copy style={{ color: c.accent, fontSize: 12 }}>{active ? '✓ Đã chọn' : 'Đang mở bán'}</Copy>
            </Pressable>
          </View>
        );
      })}
      {!!choices.other.length && (
        <Disclosure title={`Lịch diễn khác · ${choices.other.length}`}>
          {choices.other.map((session) => (
            <View key={session.id} style={{ paddingVertical: 8, gap: 4 }}>
              <Copy style={ui.semibold}>{formatSessionTime(session.startsAt, session.venue?.timezone)}</Copy>
              {session.title && <Copy>{session.title}</Copy>}
              <Copy style={ui.muted}>
                {session.status === 'CANCELLED'
                  ? 'Đã hủy'
                  : session.salesPaused
                    ? 'Tạm dừng bán'
                    : session.status === 'POSTPONED'
                      ? 'Đã hoãn'
                      : session.status === 'SCHEDULED'
                        ? 'Chưa mở bán'
                        : session.status === 'ONGOING'
                          ? 'Đang diễn ra'
                          : session.status === 'ENDED'
                            ? 'Đã kết thúc'
                            : 'Đã đóng bán'}
              </Copy>
              <TextAction
                onPress={() =>
                  router.push({
                    pathname: '/sessions/[sessionId]/status',
                    params: { sessionId: session.id, eventId },
                  })
                }
              >
                Xem thông tin
              </TextAction>
            </View>
          ))}
        </Disclosure>
      )}
    </Screen>
  );
}
