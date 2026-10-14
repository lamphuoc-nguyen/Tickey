import { expect, it } from 'vitest';
import { seatGeometry } from './seat-geometry';
import { generateSeatGrid } from './validate';
it('keeps Material seat targets legible for the existing 30-unit layout grid', () => {
  const geometry = seatGeometry({
    version: 1,
    zones: [{ id: 'a', name: 'A', type: 'seated', capacity: 4, seats: generateSeatGrid('a', 2, 2, 30) }],
  });
  expect(geometry.diameter * geometry.initialZoom).toBeCloseTo(48);
  expect(30 * geometry.initialZoom).toBeCloseTo(56);
});
