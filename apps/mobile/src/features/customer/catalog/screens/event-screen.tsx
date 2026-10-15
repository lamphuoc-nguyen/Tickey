import { formatSessionTime } from '@event/core';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import {
  ActionFooter,
  Button,
  Copy,
  Heading,
  Icon,
  Notice,
  QueryState,
  Screen,
  c,
  ui,
} from '@/components/ui';
import { useEvent, useSessions } from '../hooks/use-catalog';
import { eventPhoto } from '../components/event-card';

export default function EventScreen() {
  const { eventId = '' } = useLocalSearchParams<{ eventId: string }>();
  const event = useEvent(eventId);
  const sessions = useSessions(eventId);
  const first = sessions.data?.[0];
  return (
    <Screen
      contentStyle={{ padding: 0, gap: 0 }}
      footer={
        event.data && (
          <View style={ui.row}>
            <View style={{ flex: 1 }}>
              <Copy style={{ fontSize: 10, color: c.muted }}>Giá vé</Copy>
              <Heading small>Xem hạng vé</Heading>
            </View>
            <View style={{ flex: 1.2 }}>
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
          <View style={{ height: 232 }}>
            {event.data.coverImageUrl ? (
              <Image
                source={eventPhoto(event.data)}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : (
              <View style={{ height: 232, backgroundColor: c.navy }} />
            )}
            <View style={{ position: 'absolute', bottom: 22, left: 20, right: 20 }}>
              <Copy style={{ color: 'white', fontSize: 11 }}>{event.data.category?.name ?? 'SỰ KIỆN'}</Copy>
              <Copy
                numberOfLines={3}
                style={{
                  fontFamily: 'Lora-Bold',
                  fontWeight: '700',
                  color: 'white',
                  fontSize: 36,
                  lineHeight: 53,
                }}
              >
                {event.data.title}
              </Copy>
            </View>
          </View>
          <View style={{ padding: 20, gap: 16 }}>
            {event.data.category && <Notice warning>{event.data.category.name}</Notice>}
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
                  <Copy>{formatSessionTime(first.startsAt, first.venue?.timezone)}</Copy>
                </View>
                {first.venue && (
                  <View style={ui.row}>
                    <Icon name="venue" />
                    <Copy style={{ flex: 1 }}>
                      {first.venue.name} · {first.venue.city}
                    </Copy>
                  </View>
                )}
                <Button
                  secondary
                  onPress={() =>
                    router.push({
                      pathname: '/events/[eventId]/venue',
                      params: { eventId, sessionId: first.id },
                    })
                  }
                >
                  Thông tin địa điểm
                </Button>
              </>
            )}
            <Heading small>{event.data.summary}</Heading>
            {!event.data.summary && !event.data.description && (
              <Copy style={ui.muted}>Chưa có mô tả chi tiết.</Copy>
            )}
            <Copy style={ui.muted}>{event.data.description}</Copy>
            {event.data.ageLimit !== null && <Notice>Độ tuổi tối thiểu: {event.data.ageLimit}.</Notice>}
            {event.data.terms && (
              <>
                <Heading small>Điều khoản sự kiện</Heading>
                <Copy>{event.data.terms}</Copy>
              </>
            )}
            {
              <View style={[ui.card, { marginTop: 24 }]}>
                <Copy style={{ color: c.muted, fontSize: 11 }}>Được tổ chức bởi</Copy>
                <View style={[ui.row, { justifyContent: 'space-between' }]}>
                  <Copy style={ui.muted}>Chưa có thông tin đơn vị tổ chức.</Copy>
                </View>
              </View>
            }
          </View>
        </>
      )}
    </Screen>
  );
}
