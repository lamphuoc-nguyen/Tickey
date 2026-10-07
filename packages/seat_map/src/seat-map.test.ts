import { describe, expect, it } from 'vitest';
import { SeatGridIndex } from './spatial-index';
import type { LayoutData } from './types';
import { generateSeatGrid, validateLayout } from './validate';

const layout: LayoutData = {
  version: 1,
  zones: [
    { id: 'A', name: 'Khu A', type: 'seated', capacity: 50_000, seats: generateSeatGrid('A', 200, 250) },
    { id: 'GA', name: 'Khu đứng', type: 'standing', capacity: 1000 },
  ],
};

describe('SeatGridIndex', () => {
  const index = new SeatGridIndex(layout);

  it('returns only the seats inside the viewport', () => {
    const seats = index.query({ x: 0, y: 0, width: 60, height: 30 });
    expect(seats.map((s) => s.id).sort()).toEqual(['A-1-1', 'A-1-2', 'A-1-3', 'A-2-1', 'A-2-2', 'A-2-3']);
  });

  it('hit-tests the nearest seat within the radius', () => {
    expect(index.hitTest(31, 29, 10)?.id).toBe('A-2-2');
    expect(index.hitTest(15, 15, 5)).toBeNull();
  });
});

describe('validateLayout', () => {
  it('accepts a 50.000-seat layout', () => {
    expect(validateLayout(layout)).toEqual([]);
  });

  it('reports duplicate seats and over-capacity zones', () => {
    const bad: LayoutData = {
      version: 1,
      zones: [
        {
          id: 'B',
          name: 'B',
          type: 'seated',
          capacity: 1,
          seats: [...generateSeatGrid('B', 1, 1), ...generateSeatGrid('B', 1, 1)],
        },
      ],
    };
    expect(validateLayout(bad)).toEqual(['Duplicate seat id: B-1-1', 'Zone B: 2 seats exceed capacity 1']);
  });
});
