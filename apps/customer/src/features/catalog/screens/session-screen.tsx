import { formatSessionTime } from '@event/core';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, View } from 'react-native';
import { ActionFooter, Button, Copy, Heading, Notice, QueryState, Screen, c, ui } from '@/components/ui';
import { useSessions } from '../hooks/use-catalog';
import { useBookingDraft } from '@/features/booking/draft-store';
import { useFormDraft } from '@/features/forms/use-form-draft';

export default function SessionScreen() {
  const { eventId = '' } = useLocalSearchParams<{ eventId: string }>();
  const query = useSessions(eventId);
  const { draft, update } = useFormDraft(`sessions:${eventId}`, { selectedId: null as string | null });
  const selectedId = draft.selectedId;
  const select = (selectedId: string) => update({ selectedId });
  const pending = useBookingDraft((s) => s.unresolved);
  const pendingSession = useBookingDraft((s) => s.sessionId);
  const firstAvailable = query.data?.find((s) => s.status === 'ON_SALE' && !s.salesPaused);
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
                  ? 'Chưa có suất diễn đang bán.'
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
          Tiếp tục{selected?.title ? ` · ${selected.title}` : ''}
        </ActionFooter>
      }
    >
      <Heading>Chọn suất diễn</Heading>
      <QueryState
        loading={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
        empty={!query.isPending && !query.error && !query.data?.length}
        emptyText="Sự kiện chưa có suất diễn."
      />
      {query.data?.map((s) => {
        const active = s.id === selected?.id;
        const available = s.status === 'ON_SALE' && !s.salesPaused;
        return (
          <View key={s.id} style={{ gap: 8 }}>
            <Pressable
              accessibilityRole="radio"
              accessibilityLabel={`${s.title}, ${formatSessionTime(s.startsAt, s.venue?.timezone)}`}
              accessibilityState={{ checked: active, disabled: !available }}
              disabled={!available}
              key={s.id}
              onPress={() => select(s.id)}
              style={[
                ui.card,
                {
                  backgroundColor: active ? c.tint : 'white',
                  borderColor: active ? c.accent : c.border,
                  opacity: available ? 1 : 0.6,
                },
              ]}
            >
              <Copy style={ui.semibold}>
                {s.title ?? 'Suất diễn'} · {formatSessionTime(s.startsAt, s.venue?.timezone)}
              </Copy>
              <Copy style={ui.muted}>
                {s.venue?.name} · {s.venue?.city}
              </Copy>
              <Copy style={{ color: available ? c.accent : c.muted, fontSize: 11 }}>
                {s.salesPaused
                  ? 'Tạm dừng bán'
                  : s.status === 'CANCELLED'
                    ? 'Suất diễn đã bị hủy'
                    : !available
                      ? 'Chưa mở hoặc đã đóng bán'
                      : active
                        ? 'Đã chọn · Đang mở bán'
                        : 'Đang mở bán'}
              </Copy>
            </Pressable>
            {!available && (
              <Button
                secondary
                onPress={() =>
                  router.push({
                    pathname: '/sessions/[sessionId]/status',
                    params: { sessionId: s.id, eventId },
                  })
                }
              >
                Xem thông tin suất diễn
              </Button>
            )}
          </View>
        );
      })}
      <Notice>Thời gian hiển thị theo múi giờ địa điểm tổ chức.</Notice>
    </Screen>
  );
}
