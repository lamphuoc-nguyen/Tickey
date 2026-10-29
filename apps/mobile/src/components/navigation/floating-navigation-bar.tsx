import { useCallback, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useColorScheme,
  type ViewProps,
  type ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useFloatingNavigation, useTabIndicator } from './floating-navigation-context';

export type FloatingTab = {
  id: string;
  label: string;
  source: ImageSourcePropType;
  activeSource?: ImageSourcePropType;
  onPress: () => void;
  onReselect?: () => void;
};

function supportsGlass() {
  if (Platform.OS !== 'ios') return false;
  try {
    return isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

export function FloatingNavigationBar({ tabs, active }: { tabs: readonly FloatingTab[]; active: string }) {
  const { geometry, progress, keyboard, focused, show } = useFloatingNavigation();
  const dark = useColorScheme() === 'dark';
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [glassAvailable] = useState(supportsGlass);
  const [barWidth, setBarWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === active),
  );
  const localIndex = useSharedValue(activeIndex);
  const sharedIndex = useTabIndicator();
  const indicator = sharedIndex ?? localIndex;
  useFocusEffect(
    useCallback(() => {
      indicator.set(
        withTiming(activeIndex, {
          duration: 280,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }),
      );
      if (Platform.OS !== 'ios') return;
      let mounted = true;
      void AccessibilityInfo.isReduceTransparencyEnabled()
        .then((enabled) => {
          if (mounted) setReduceTransparency(enabled);
        })
        .catch(() => {
          if (mounted) setReduceTransparency(true);
        });
      const subscription = AccessibilityInfo.addEventListener(
        'reduceTransparencyChanged',
        setReduceTransparency,
      );
      return () => {
        mounted = false;
        subscription.remove();
      };
    }, [activeIndex, indicator]),
  );
  const colors = dark
    ? {
        surface: reduceTransparency ? '#191C23' : 'rgba(25,28,35,0.96)',
        border: 'rgba(255,255,255,0.15)',
        capsule: '#503A37',
        active: '#FFB4A5',
        inactive: '#C4C5CE',
      }
    : {
        surface: reduceTransparency ? '#FFFAF8' : 'rgba(255,250,248,0.96)',
        border: 'rgba(137,113,108,0.2)',
        capsule: '#FFDAD3',
        active: '#B93824',
        inactive: '#6F5C58',
      };
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ translateY: (1 - progress.get()) * geometry.hiddenY }],
  }));
  const animatedProps = useAnimatedProps<ViewProps>(() => {
    const hidden = progress.get() < 0.05 || keyboard.get() || !focused.get();
    return {
      pointerEvents: hidden ? 'none' : 'box-none',
      accessibilityElementsHidden: hidden,
      importantForAccessibility: hidden ? 'no-hide-descendants' : 'auto',
    };
  });
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (indicator.get() * Math.max(0, barWidth - 12)) / tabs.length }],
  }));
  const glass = glassAvailable && !reduceTransparency;
  return (
    <Animated.View
      testID="floating-navigation"
      animatedProps={animatedProps}
      style={[
        styles.floating,
        {
          height: geometry.height,
          bottom: geometry.bottom,
          backgroundColor: glass ? 'transparent' : colors.surface,
        },
        animatedStyle,
      ]}
    >
      <View
        style={[styles.surface, { borderColor: colors.border }]}
        onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      >
        {glass && (
          <GlassView
            pointerEvents="none"
            colorScheme={dark ? 'dark' : 'light'}
            glassEffectStyle="regular"
            tintColor={dark ? '#191C2366' : '#FFFAF866'}
            style={StyleSheet.absoluteFill}
          />
        )}
        {barWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { width: (barWidth - 12) / tabs.length, backgroundColor: colors.capsule },
              indicatorStyle,
            ]}
          />
        )}
        {tabs.map((tab) => {
          const selected = tab.id === active;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected }}
              testID={`navigation-tab-${tab.id}`}
              onPress={() => {
                Keyboard.dismiss();
                show();
                if (selected) tab.onReselect?.();
                else tab.onPress();
              }}
              style={({ pressed }) => [styles.tab, pressed && { opacity: 0.65 }]}
            >
              <Image
                source={selected ? (tab.activeSource ?? tab.source) : tab.source}
                tintColor={selected ? colors.active : colors.inactive}
                style={styles.icon}
                contentFit="contain"
              />
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  floating: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 50,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  surface: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    padding: 5,
  },
  indicator: { position: 'absolute', left: 5, top: 5, bottom: 5, borderRadius: 999 },
  tab: {
    flex: 1,
    minHeight: 48,
    minWidth: 44,
    paddingHorizontal: 3,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { width: 24, height: 24 },
});
