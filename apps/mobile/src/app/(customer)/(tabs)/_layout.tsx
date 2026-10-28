import { PersistentTabLayout } from '@/components/navigation/persistent-tab-layout';
const screens = [
  { name: 'index', title: 'Khám phá' },
  { name: 'orders', title: 'Vé của tôi' },
  { name: 'notifications', title: 'Thông báo' },
  { name: 'profile', title: 'Tài khoản' },
] as const;
export default function CustomerTabsLayout() {
  return <PersistentTabLayout screens={screens} />;
}
