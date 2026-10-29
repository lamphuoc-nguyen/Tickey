export type NavigationVisibility = { focused: boolean; keyboard: boolean; visible: boolean };

/** Focus changes never start a hide/show animation; only scrolling changes visibility. */
export function navigationVisibilityTransition(
  next: NavigationVisibility,
  previous: NavigationVisibility | null,
): { target: 0 | 1; animated: boolean } | null {
  'worklet';
  // Keep the outgoing capsule visible while its scene slides away, but not interactive.
  if (!next.focused) return null;
  if (next.keyboard) return { target: 0, animated: false };
  if (!previous?.focused || previous.keyboard) return { target: 1, animated: false };
  if (next.visible === previous.visible) return null;
  return { target: next.visible ? 1 : 0, animated: true };
}
