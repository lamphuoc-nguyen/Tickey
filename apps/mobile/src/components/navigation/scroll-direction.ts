export type ScrollDirectionState = {
  lastY: number;
  direction: -1 | 0 | 1;
  distance: number;
  visible: boolean;
};
export type ScrollMetrics = {
  y: number;
  contentHeight: number;
  viewportHeight: number;
  insetTop?: number;
  insetBottom?: number;
  scrolling?: boolean;
};

export const SCROLL_THRESHOLD = 12;
export const TOP_REVEAL_DISTANCE = 24;

export function initialScrollDirection(): ScrollDirectionState {
  'worklet';
  return { lastY: 0, direction: 0, distance: 0, visible: true };
}

/** Runs unchanged in unit tests and on Reanimated's UI thread. */
export function nextScrollDirection(
  state: ScrollDirectionState,
  metrics: ScrollMetrics,
): ScrollDirectionState {
  'worklet';
  const top = metrics.insetTop ?? 0;
  const bottom = metrics.insetBottom ?? 0;
  if (!Number.isFinite(metrics.contentHeight) || !Number.isFinite(metrics.viewportHeight)) return state;
  const maxY = Math.max(0, metrics.contentHeight + top + bottom - metrics.viewportHeight);
  const y = metrics.y + top;
  const clamped = Math.min(maxY, Math.max(0, y));
  if (metrics.viewportHeight <= 0 || !Number.isFinite(y)) return state;
  // Any real scroll range counts, even when it is shorter than the floating bar's clearance.
  if (maxY <= 1 || y <= TOP_REVEAL_DISTANCE)
    return { lastY: clamped, direction: 0, distance: 0, visible: true };
  // Ignore the bottom rubber-band and its rebound. Do not interpret it as an upward gesture.
  if (y > maxY || metrics.scrolling === false) return { ...state, lastY: clamped, direction: 0, distance: 0 };
  const delta = clamped - state.lastY;
  if (Math.abs(delta) < 0.01) return state;
  const direction = delta > 0 ? 1 : -1;
  const distance = (direction === state.direction ? state.distance : 0) + Math.abs(delta);
  const crossed = distance >= SCROLL_THRESHOLD;
  return {
    lastY: clamped,
    direction,
    distance: crossed ? 0 : distance,
    visible: crossed ? direction < 0 : state.visible,
  };
}

export function navigationGeometry(bottomInset: number) {
  const height = 60;
  const bottom = Math.max(0, bottomInset) + 12;
  return { height, bottom, clearance: height + bottom + 16, hiddenY: height + bottom + 40 };
}
