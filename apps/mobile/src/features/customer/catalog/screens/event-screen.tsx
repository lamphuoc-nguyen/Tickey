import { formatSessionTime } from '@event/core';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ActionFooter, Copy, Heading, Icon, QueryState, Screen, c, ui } from '@/components/ui';
import { Badge, Disclosure, MenuRow } from '@/components/customer-controls';
import { useEvent, useSessions } from '../hooks/use-catalog';
import { eventPhoto } from '../components/event-card';

export default function EventScreen() {
  const { eventId = '' } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const sessions = useSessions(eventId);
  const first =
    sessions.data?.find((session) => session.status === 'ON_SALE' && !session.salesPaused) ??
    sessions.data?.[0];
  return (
    <Screen
      contentStyle={{ padding: 0, gap: 0 }}
      footer={
        event.data && (
          <View style={ui.row}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Copy style={{ fontSize: 10, color: c.muted }}>Giá vé</Copy>
              <Heading small>Xem hạng vé</Heading>
            </View>
            <View style={{ flex: 1.2, minWidth: 0 }}>
              <ActionFooter
                onPress={() => router.push({ pathname: '/events/[eventId]/sessions', params: { eventId } })}
              >
                Chọn suất diễn
              </ActionFooter>
            </View>
          </View>
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
                  <Copy style={{ flex: 1 }}>{formatSessionTime(first.startsAt, first.venue?.timezone)}</Copy>
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
    </Screen>
  );
}
