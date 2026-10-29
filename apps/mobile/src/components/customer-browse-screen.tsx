import type { ComponentProps } from 'react';
import { Screen } from './ui';
import { TabBar } from './tab-bar';

/** Shared browsing chrome. Transaction steps and input forms keep using Screen directly. */
export function CustomerBrowseScreen({
  tab,
  ...props
}: Omit<ComponentProps<typeof Screen>, 'bottomNavigation'> & {
  tab: ComponentProps<typeof TabBar>['current'];
}) {
  return <Screen {...props} bottomNavigation={<TabBar current={tab} />} />;
}
