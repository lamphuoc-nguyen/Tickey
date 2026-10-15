import type { Event } from '@event/core';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Copy, c, ui } from '@/components/ui';
export function eventPhoto(event: Event) {
  return event.coverImageUrl;
}
export function EventCard({
  event,
  small = false,
  onSelect,
}: {
  event: Event;
  small?: boolean;
  onSelect?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem ${event.title}`}
      onPress={() => {
        onSelect?.();
        router.push({ pathname: '/events/[eventId]', params: { eventId: event.id } });
      }}
      style={[ui.card, { padding: 8, gap: 12, width: small ? 170 : '100%', minHeight: small ? 224 : 228 }]}
    >
      {event.coverImageUrl ? (
        <Image
          source={event.coverImageUrl}
          style={{ height: small ? 106 : 126, borderRadius: 10, width: '100%' }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            height: small ? 106 : 126,
            backgroundColor: c.tint,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Copy style={ui.muted}>Chưa có ảnh sự kiện</Copy>
        </View>
      )}
      <View style={{ gap: 4 }}>
        <Copy style={ui.semibold}>{event.title}</Copy>
        <Copy style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>
          {event.summary ?? 'Thông tin chi tiết trong sự kiện'}
        </Copy>
        <Copy style={{ color: c.accent, fontFamily: 'BeVietnamPro-SemiBold', fontSize: 12 }}>
          Xem hạng vé
        </Copy>
      </View>
    </Pressable>
  );
}
