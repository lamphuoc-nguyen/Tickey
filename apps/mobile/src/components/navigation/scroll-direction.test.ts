import { describe, expect, it } from 'vitest';
import {
  initialScrollDirection,
  navigationGeometry,
  nextScrollDirection,
  type ScrollDirectionState,
} from './scroll-direction';

const metrics = (y: number) => ({
  y,
  contentHeight: 2000,
  viewportHeight: 700,
  reservedBottom: 120,
  scrolling: true,
});
const at = (y = 100, visible = true): ScrollDirectionState => ({
  ...initialScrollDirection(),
  lastY: y,
  visible,
});

describe('floating navigation scroll hysteresis', () => {
  it('accumulates slow downward movement before hiding, then slow upward movement before showing', () => {
    let state = at();
    for (const y of [102, 104, 107, 111]) {
      state = nextScrollDirection(state, metrics(y));
      expect(state.visible).toBe(true);
    }
    state = nextScrollDirection(state, metrics(113));
    expect(state.visible).toBe(false);
    for (const y of [110, 107, 103]) {
      state = nextScrollDirection(state, metrics(y));
      expect(state.visible).toBe(false);
    }
    expect(nextScrollDirection(state, metrics(101)).visible).toBe(true);
  });
  it('responds to a fast fling in either direction without waiting for the top', () => {
    const hidden = nextScrollDirection(at(), metrics(600));
    expect(hidden.visible).toBe(false);
    expect(nextScrollDirection(hidden, metrics(550)).visible).toBe(true);
  });
  it('resets accumulated distance on every change of direction, avoiding tiny oscillations', () => {
    let state = at();
    for (const y of [105, 101, 106, 102, 107, 103, 108]) state = nextScrollDirection(state, metrics(y));
    expect(state.visible).toBe(true);
    expect(nextScrollDirection(state, metrics(120)).visible).toBe(false);
  });
  it('holds its state when scrolling stops and ignores programmatic restoration', () => {
    const hidden = at(600, false);
    expect(nextScrollDirection(hidden, metrics(600))).toBe(hidden);
    expect(nextScrollDirection(hidden, { ...metrics(300), scrolling: false }).visible).toBe(false);
    expect(nextScrollDirection(at(), { ...metrics(700), scrolling: false }).visible).toBe(true);
  });
  it('always shows near the top, including the iOS pull-to-refresh bounce', () => {
    expect(nextScrollDirection(at(300, false), metrics(20)).visible).toBe(true);
    expect(nextScrollDirection(at(300, false), metrics(-40)).visible).toBe(true);
  });
  it('ignores bottom overscroll and its small rebound rather than mistaking it for an up gesture', () => {
    let state = nextScrollDirection(at(1290, false), metrics(1340));
    expect(state.visible).toBe(false);
    expect(state.lastY).toBe(1300);
    state = nextScrollDirection(state, metrics(1297));
    expect(state.visible).toBe(false);
    expect(nextScrollDirection(state, metrics(1287)).visible).toBe(true);
  });
  it('keeps short lists visible, including lists which can scroll only their bottom clearance', () => {
    for (const contentHeight of [500, 700, 800])
      expect(nextScrollDirection(at(100, false), { ...metrics(100), contentHeight }).visible).toBe(true);
  });
  it('normalizes iOS content insets and ignores missing layout measurements', () => {
    expect(nextScrollDirection(at(300, false), { ...metrics(-44), insetTop: 44 }).visible).toBe(true);
    const state = at();
    expect(nextScrollDirection(state, { ...metrics(100), viewportHeight: 0 })).toBe(state);
    expect(nextScrollDirection(state, { ...metrics(100), y: NaN })).toBe(state);
    expect(nextScrollDirection(state, { ...metrics(100), contentHeight: NaN })).toBe(state);
  });
});

describe('floating navigation safe area and content clearance', () => {
  it('moves the entire capsule and shadow beyond the viewport on both navigation modes', () => {
    for (const inset of [0, 24, 34, 48]) {
      const geometry = navigationGeometry(inset);
      expect(geometry.bottom).toBe(inset + 12);
      expect(geometry.hiddenY - geometry.bottom - geometry.height).toBeGreaterThanOrEqual(32);
      expect(geometry.clearance).toBeGreaterThan(geometry.bottom + geometry.height);
    }
  });
});
