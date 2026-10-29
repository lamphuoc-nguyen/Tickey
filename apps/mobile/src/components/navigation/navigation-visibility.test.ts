import { describe, expect, it } from 'vitest';
import { navigationVisibilityTransition, type NavigationVisibility } from './navigation-visibility';

const visible: NavigationVisibility = { focused: true, keyboard: false, visible: true };

describe('floating bar across tab transitions', () => {
  it('keeps the outgoing scene bar in place on blur rather than hiding it', () => {
    expect(navigationVisibilityTransition({ ...visible, focused: false }, visible)).toBeNull();
  });
  it('shows an arriving tab immediately, including one which was previously scrolled down', () => {
    const hidden = { ...visible, visible: false };
    expect(navigationVisibilityTransition(visible, null)).toEqual({ target: 1, animated: false });
    expect(navigationVisibilityTransition(hidden, { ...hidden, focused: false })).toEqual({
      target: 1,
      animated: false,
    });
  });
  it('animates only a scroll visibility change while focused and holds on idle', () => {
    const hidden = { ...visible, visible: false };
    expect(navigationVisibilityTransition(hidden, visible)).toEqual({ target: 0, animated: true });
    expect(navigationVisibilityTransition(visible, hidden)).toEqual({ target: 1, animated: true });
    expect(navigationVisibilityTransition(visible, visible)).toBeNull();
    expect(navigationVisibilityTransition(hidden, hidden)).toBeNull();
  });
  it('preserves the keyboard exception without a slide on tab focus or keyboard dismissal', () => {
    const keyboard = { ...visible, keyboard: true };
    expect(navigationVisibilityTransition(keyboard, visible)).toEqual({ target: 0, animated: false });
    expect(navigationVisibilityTransition(visible, keyboard)).toEqual({ target: 1, animated: false });
    expect(navigationVisibilityTransition({ ...keyboard, focused: false }, keyboard)).toBeNull();
  });
});
