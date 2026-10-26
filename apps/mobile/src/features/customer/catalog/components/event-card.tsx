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
  width,
  onSelect,
  selected = false,
}: {
  event: Event;
  small?: boolean;
  width?: number;
  onSelect?: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onSelect ? 'radio' : 'button'}
      accessibilityState={onSelect ? { checked: selected } : undefined}
      accessibilityLabel={`${onSelect ? 'Chọn' : 'Xem'} ${event.title}`}
      onPress={() => {
        if (onSelect) onSelect();
        else router.push({ pathname: '/events/[eventId]', params: { eventId: event.id } });
      }}
      style={[
        ui.card,
        { padding: 8, gap: 12, width: width ?? (small ? 170 : '100%'), minHeight: small ? 224 : 228 },
        selected && { borderColor: c.accent, backgroundColor: c.tint },
      ]}
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
      <View style={{ gap: 4, flex: 1 }}>
        <Copy numberOfLines={2} style={[ui.semibold, { minHeight: 40 }]}>
          {event.title}
        </Copy>
        {event.category && (
          <Copy numberOfLines={1} style={{ color: c.muted, fontSize: 11, lineHeight: 16 }}>
            {event.category.name}
          </Copy>
        )}
        <Copy
          style={{
            color: c.accent,
            fontFamily: 'BeVietnamPro-SemiBold',
            fontSize: 12,
            marginTop: 'auto',
            paddingTop: 4,
          }}
        >
          Xem hạng vé
        </Copy>
      </View>
    </Pressable>
  );
}
