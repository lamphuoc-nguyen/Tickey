import { router } from 'expo-router';
import { icons } from './ui';
import { FloatingNavigationBar } from './navigation/floating-navigation-bar';

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
    <FloatingNavigationBar
      active={current}
      tabs={tabs.map((tab) => ({
        id: tab.path,
        label: tab.label,
        source: 'inactive' in tab ? tab.inactive : icons[tab.icon].source,
        activeSource: tab.active,
        onPress: () => router.navigate(tab.path),
      }))}
    />
  );
}
