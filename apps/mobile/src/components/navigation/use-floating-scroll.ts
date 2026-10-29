import { useCallback } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useAnimatedReaction, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useFloatingNavigation } from './floating-navigation-context';
import { nextScrollDirection } from './scroll-direction';

/** Spread onto ONE primary Animated.ScrollView/FlatList/SectionList, never a horizontal child list. */
export function useFloatingNavigationScroll() {
  const { direction, focused, scrolling } = useFloatingNavigation();
  const contentHeight = useSharedValue(0);
  const viewportHeight = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => {
      scrolling.set(true);
    },
    onEndDrag: () => {
      scrolling.set(false);
    },
    onMomentumBegin: () => {
      scrolling.set(true);
    },
    onMomentumEnd: () => {
      scrolling.set(false);
    },
    onScroll: (event) => {
      if (!focused.get()) return;
      direction.set(
        nextScrollDirection(direction.get(), {
          y: event.contentOffset.y,
          contentHeight: event.contentSize.height,
          viewportHeight: event.layoutMeasurement.height,
          insetTop: event.contentInset?.top ?? 0,
          insetBottom: event.contentInset?.bottom ?? 0,
          scrolling: scrolling.get(),
        }),
      );
    },
  });
  useAnimatedReaction(
    () => ({ content: contentHeight.get(), viewport: viewportHeight.get(), focused: focused.get() }),
    ({ content, viewport, focused: active }) => {
      if (active && viewport > 0 && content <= viewport + 1)
        direction.set({ ...direction.get(), direction: 0, distance: 0, visible: true });
    },
  );
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => viewportHeight.set(event.nativeEvent.layout.height),
    [viewportHeight],
  );
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => contentHeight.set(height),
    [contentHeight],
  );
  return { onScroll, onLayout, onContentSizeChange, scrollEventThrottle: 16 as const };
}
