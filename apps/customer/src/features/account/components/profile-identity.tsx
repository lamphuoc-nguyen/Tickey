import type { Profile } from '@event/core';
import { Image } from 'expo-image';
import { View } from 'react-native';
import { Copy, Heading, Icon, c, ui } from '@/components/ui';
export function ProfileIdentity({ profile }: { profile?: Profile }) {
  const initials = profile?.fullName
    ?.split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();
  return (
    <View style={[ui.card, ui.row, { backgroundColor: c.tint, borderWidth: 0 }]}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: c.accent,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {profile?.avatarUrl ? (
          <Image source={profile.avatarUrl} style={{ width: 56, height: 56 }} contentFit="cover" />
        ) : initials ? (
          <Copy style={{ color: 'white', fontFamily: 'BeVietnamPro-Bold', fontSize: 17 }}>{initials}</Copy>
        ) : (
          <Icon name="logo" />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Heading small>{profile?.fullName ?? 'Chưa có thông tin tên'}</Heading>
        <Copy style={{ fontSize: 11, color: c.muted }}>{profile?.email ?? 'Chưa tải được email'}</Copy>
      </View>
    </View>
  );
}
