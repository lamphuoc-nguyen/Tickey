import { describe, expect, it } from 'vitest';
import { displaySeatState, layoutBounds, visibleSeats } from './render-plan';
import { SeatGridIndex } from './spatial-index';
import { generateSeatGrid } from './validate';
describe('viewport rendering', () => {
  it('starts the camera at a zone with non-zero layout coordinates', () => {
    const layout = {
      version: 1,
      zones: [
        {
          id: 'z',
          name: 'Zone',
          type: 'seated' as const,
          capacity: 1,
          seats: [{ id: 's', row: 'A', number: '1', x: 2000, y: 1000 }],
        },
      ],
    };
    expect(layoutBounds(layout)).toEqual({ minX: 2000, maxX: 2000, minY: 1000, maxY: 1000 });
    expect(
      visibleSeats(new SeatGridIndex(layout), { x: 2000 - 57, y: 1000 - 24, width: 350, height: 440 }).map(
        (s) => s.id,
      ),
    ).toEqual(['s']);
  });
  it('bounds the rendered subtree independently of total seat count', () => {
    const index = new SeatGridIndex({
      version: 1,
      zones: [
        { id: 'a', name: 'A', type: 'seated', capacity: 50000, seats: generateSeatGrid('a', 250, 200, 56) },
      ],
    });
    expect(visibleSeats(index, { x: 0, y: 0, width: 350, height: 440 }).length).toBeLessThan(100);
  });
  it('keeps SELECTED/CONFLICT outside persisted inventory state', () => {
    const state = { a: 'AVAILABLE' as const };
    expect(displaySeatState('a', state, new Set(['a']))).toBe('SELECTED');
    expect(displaySeatState('a', state, new Set(['a']), new Set(['a']))).toBe('CONFLICT');
    expect(state.a).toBe('AVAILABLE');
  });
});
