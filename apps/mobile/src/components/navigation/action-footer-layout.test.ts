import { describe, expect, it } from 'vitest';
import { navigationGeometry } from './scroll-direction';
import { actionFooterLayout } from './action-footer-layout';

describe('action footer moving with floating navigation', () => {
  it.each([0, 24, 34, 48])(
    'keeps the action above the capsule and returns it to the safe area (%idp)',
    (inset) => {
      const nav = navigationGeometry(inset);
      const footer = actionFooterLayout(nav.clearance, 70 + Math.max(inset, 16), inset);
      const visibleButtonBottom = footer.bottomPadding + footer.lift;
      expect(visibleButtonBottom).toBeGreaterThanOrEqual(nav.bottom + nav.height + 16);
      // At progress=0 the footer is translated by zero and its action rests at this inset.
    expect(footer.bottomPadding).toBe(Math.max(16, inset) + 12);
      expect(footer.lift).toBeGreaterThan(0);
    },
  );
  it('reserves the whole measured footer even with larger text or multiple actions', () => {
    const nav = navigationGeometry(34);
    const small = actionFooterLayout(nav.clearance, 100, 34);
    const large = actionFooterLayout(nav.clearance, 220, 34);
    expect(large.contentClearance - small.contentClearance).toBe(120);
    expect(large.contentClearance).toBe(220 + large.lift);
    expect(actionFooterLayout(nav.clearance, 0, 34).contentClearance).toBeGreaterThan(nav.clearance);
  });
});
