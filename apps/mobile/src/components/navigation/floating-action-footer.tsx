import type { PropsWithChildren } from 'react';
import { StyleSheet, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useFloatingNavigation } from './floating-navigation-context';

export function FloatingActionFooter({
  children,
  style,
  bottomPadding,
  lift,
  onLayout,
}: PropsWithChildren<{
  style: StyleProp<ViewStyle>;
  bottomPadding: number;
  lift: number;
  onLayout: (event: LayoutChangeEvent) => void;
}>) {
  const { progress } = useFloatingNavigation();
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.get() * lift }],
  }));
  return (
    <Animated.View
      testID="floating-action-footer"
      onLayout={onLayout}
      style={[style, styles.overlay, { paddingBottom: bottomPadding }, animatedStyle]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 40 },
});
