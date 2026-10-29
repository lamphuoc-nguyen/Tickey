import { formatSessionTime } from '@event/core';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ActionFooter, Copy, Heading, Icon, QueryState, c, ui } from '@/components/ui';
import { CustomerBrowseScreen } from '@/components/customer-browse-screen';
import { Badge, Disclosure, MenuRow, TextAction } from '@/components/customer-controls';
import { useEvent, useSessions } from '../hooks/use-catalog';
import { eventPhoto } from '../components/event-card';
import { sessionChoices } from '../catalog-presentation';

export default function EventScreen() {
  const { eventId = '' } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const sessions = useSessions(eventId);
  const choices = sessionChoices(sessions.data ?? []);
  const first = choices.available[0] ?? choices.other[0];
  const openDates = () => router.push({ pathname: '/events/[eventId]/sessions', params: { eventId } });
  return (
    <CustomerBrowseScreen
      tab="/"
      contentStyle={{ padding: 0, gap: 0 }}
      footer={
        event.data && (
          <ActionFooter
            onPress={openDates}
            busy={sessions.isPending}
            disabled={!!sessions.error || (!sessions.isPending && !sessions.data?.length)}
            disabledReason={
              sessions.error
                ? 'Chưa tải được lịch diễn. Vui lòng thử lại.'
                : 'Sự kiện chưa công bố lịch diễn.'
            }
          >
            {choices.available.length ? 'Đặt vé' : 'Xem lịch diễn'}
          </ActionFooter>
        )
      }
    >
      <View style={{ paddingHorizontal: event.data ? 0 : 20 }}>
        <QueryState loading={event.isPending} error={event.error} retry={() => void event.refetch()} />
      </View>
      {event.data && (
        <>
          <View style={{ height: event.data.coverImageUrl ? 232 : 160 }}>
            {event.data.coverImageUrl ? (
              <Image
                source={eventPhoto(event.data)}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <View
                style={{
                  height: 160,
                  backgroundColor: c.tint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Copy style={ui.muted}>Chưa có ảnh sự kiện</Copy>
              </View>
            )}
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
              {event.data.category && <Badge>{event.data.category.name}</Badge>}
              {event.data.ageLimit !== null && <Badge>{event.data.ageLimit}+</Badge>}
            </View>
            <Heading>{event.data.title}</Heading>
            <QueryState
              loading={sessions.isPending}
              error={sessions.error}
              retry={() => void sessions.refetch()}
            />
            {first && (
              <>
                <View style={ui.row}>
                  <Icon name="calendarAccent" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Copy style={[ui.muted, { fontSize: 12 }]}>
                      Ngày và giờ{(sessions.data?.length ?? 0) > 1 ? ' · một trong các lịch diễn' : ''}
                    </Copy>
                    <Copy>{formatSessionTime(first.startsAt, first.venue?.timezone)}</Copy>
                  </View>
                </View>
                {first.venue && (
                  <MenuRow
                    icon="venue"
                    label={first.venue.name}
                    description={first.venue.city}
                    onPress={() =>
                      router.push({
                        pathname: '/events/[eventId]/venue',
                        params: { eventId, sessionId: first.id },
                      })
                    }
                  />
                )}
                {(sessions.data?.length ?? 0) > 1 && (
                  <TextAction onPress={openDates}>Xem tất cả {sessions.data?.length} lịch diễn</TextAction>
                )}
                <Copy style={ui.muted}>Giá vé theo ngày diễn và hạng vé.</Copy>
              </>
            )}
            {!!event.data.summary && <Heading small>{event.data.summary}</Heading>}
            {!event.data.summary && !event.data.description && (
              <Copy style={ui.muted}>Chưa có mô tả chi tiết.</Copy>
            )}
            {!!event.data.description && <Copy>{event.data.description}</Copy>}
            {event.data.terms && (
              <Disclosure title="Điều khoản sự kiện">
                <Copy>{event.data.terms}</Copy>
              </Disclosure>
            )}
            <Disclosure title="Đơn vị tổ chức">
              <Copy style={ui.muted}>Chưa có thông tin đơn vị tổ chức.</Copy>
            </Disclosure>
          </View>
        </>
      )}
    </CustomerBrowseScreen>
  );
}
