import { PersistentTabLayout } from '@/components/navigation/persistent-tab-layout';
const screens = [
  { name: 'index', title: 'Ca làm' },
  { name: 'check-in', title: 'Soát vé' },
  { name: 'pos', title: 'Bán vé' },
  { name: 'tickets', title: 'Thêm' },
] as const;
export default function StaffTabsLayout() {
  return <PersistentTabLayout screens={screens} />;
}
