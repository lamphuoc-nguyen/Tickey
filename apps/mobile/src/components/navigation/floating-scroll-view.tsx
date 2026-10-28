import type { ScrollViewProps } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFloatingNavigationScroll } from './use-floating-scroll';

// For additional animated scroll callbacks, compose handlers through the hook instead.
export function FloatingScrollView({
  onLayout,
  onContentSizeChange,
  ...props
}: Omit<
  ScrollViewProps,
  'onScroll' | 'onScrollBeginDrag' | 'onScrollEndDrag' | 'onMomentumScrollBegin' | 'onMomentumScrollEnd'
>) {
  const scroll = useFloatingNavigationScroll();
  return (
    <Animated.ScrollView
      {...props}
      {...scroll}
      onLayout={(event) => {
        scroll.onLayout(event);
        onLayout?.(event);
      }}
      onContentSizeChange={(width, height) => {
        scroll.onContentSizeChange(width, height);
        onContentSizeChange?.(width, height);
      }}
    />
  );
}
