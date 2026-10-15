import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Copy, c, fonts, icons } from './ui';

const tabs = [
  {
    label: 'Khám phá',
    path: '/' as const,
    icon: 'home' as const,
    active: require('../../assets/figma/1-722-imgFrame7.svg'),
    inactive: require('../../assets/figma/1-1694-imgFrame2.svg'),
  },
  {
    label: 'Vé của tôi',
    path: '/orders' as const,
    icon: 'ticket' as const,
    active: require('../../assets/figma/1-1694-imgFrame3.svg'),
  },
  {
    label: 'Thông báo',
    path: '/notifications' as const,
    icon: 'notifications' as const,
    active: require('../../assets/figma/1-2490-imgFrame4.svg'),
  },
  {
    label: 'Tài khoản',
    path: '/profile' as const,
    icon: 'account' as const,
    active: require('../../assets/figma/1-2523-imgFrame5.svg'),
  },
];
export function TabBar({ current }: { current: (typeof tabs)[number]['path'] }) {
  return (
    <View style={{ flexDirection: 'row', marginHorizontal: -15, marginTop: -8 }}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.path}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: current === tab.path }}
          onPress={() => router.replace(tab.path)}
          style={{ flex: 1, minHeight: 64, alignItems: 'center', gap: 3, paddingTop: 0 }}
        >
          <View
            style={{
              backgroundColor: current === tab.path ? c.primaryContainer : 'transparent',
              borderRadius: 999,
              width: 56,
              height: 32,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Image
              source={
                current === tab.path
                  ? (tab.active ?? icons[tab.icon].source)
                  : 'inactive' in tab
                    ? tab.inactive
                    : icons[tab.icon].source
              }
              style={{ width: 24, height: 24 }}
              contentFit="contain"
            />
          </View>
          <Copy
            style={{
              fontFamily: fonts.medium,
              color: current === tab.path ? c.primary : '#6F5C58',
              fontSize: 11,
              lineHeight: 16,
              textAlign: 'center',
            }}
          >
            {tab.label}
          </Copy>
        </Pressable>
      ))}
    </View>
  );
}
