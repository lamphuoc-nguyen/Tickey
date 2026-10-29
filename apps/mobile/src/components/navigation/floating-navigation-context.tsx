import { createContext, useCallback, useContext, useMemo, type PropsWithChildren } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Easing,
  ReduceMotion,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { initialScrollDirection, navigationGeometry, type ScrollDirectionState } from './scroll-direction';
import { navigationVisibilityTransition } from './navigation-visibility';

type FloatingNavigationState = {
  direction: SharedValue<ScrollDirectionState>;
  progress: SharedValue<number>;
  focused: SharedValue<boolean>;
  keyboard: SharedValue<boolean>;
  scrolling: SharedValue<boolean>;
  geometry: ReturnType<typeof navigationGeometry>;
  show: () => void;
};
const Context = createContext<FloatingNavigationState | null>(null);

/** One controller per screen; only the focused screen subscribes to keyboard events. */
export function FloatingNavigationProvider({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const geometry = useMemo(() => navigationGeometry(insets.bottom), [insets.bottom]);
  const direction = useSharedValue(initialScrollDirection());
  const progress = useSharedValue(1);
  const focused = useSharedValue(false);
  const keyboard = useSharedValue(false);
  const scrolling = useSharedValue(false);
  const show = useCallback(() => {
    direction.set({ ...direction.get(), direction: 0, distance: 0, visible: true });
  }, [direction]);
  useFocusEffect(
    useCallback(() => {
      focused.set(true);
      keyboard.set(Keyboard.isVisible());
      scrolling.set(false);
      show();
      // A tab returns visible even if its retained scroll offset is halfway down the list.
      progress.set(Keyboard.isVisible() ? 0 : 1);
      const opening = Keyboard.addListener(
        Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
        () => keyboard.set(true),
      );
      const closing = Keyboard.addListener('keyboardDidHide', () => {
        keyboard.set(false);
        show();
      });
      return () => {
        focused.set(false);
        scrolling.set(false);
        opening.remove();
        closing.remove();
      };
    }, [focused, keyboard, scrolling, show, progress]),
  );

  useAnimatedReaction(
    () => ({ visible: direction.get().visible, keyboard: keyboard.get(), focused: focused.get() }),
    (next, previous) => {
      const transition = navigationVisibilityTransition(next, previous);
      if (!transition) return;
      if (!transition.animated) {
        progress.set(transition.target);
        return;
      }
      progress.set(
        withTiming(transition.target, {
          duration: transition.target ? 290 : 250,
          easing: Easing.out(Easing.cubic),
          reduceMotion: ReduceMotion.System,
        }),
      );
    },
  );
  const value = useMemo(
    () => ({ direction, progress, focused, keyboard, scrolling, geometry, show }),
    [direction, progress, focused, keyboard, scrolling, geometry, show],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export const useOptionalFloatingNavigation = () => useContext(Context);
export function useFloatingNavigation() {
  const value = useOptionalFloatingNavigation();
  if (!value) throw new Error('Floating navigation requires FloatingNavigationProvider.');
  return value;
}

const IndicatorContext = createContext<SharedValue<number> | null>(null);
export function TabIndicatorProvider({ children }: PropsWithChildren) {
  const index = useSharedValue(0);
  return <IndicatorContext.Provider value={index}>{children}</IndicatorContext.Provider>;
}
export const useTabIndicator = () => useContext(IndicatorContext);
