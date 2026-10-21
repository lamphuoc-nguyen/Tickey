import { describe, expect, it } from 'vitest';
import type { LayoutData } from '@event/seat-map';
import { selectionMapHeight } from './seat-map-viewport';

function layout(rows: number, spacing: number): LayoutData {
  return {
    version: 1,
    zones: [
      {
        id: 'zone',
        name: 'Khu ghế',
        type: 'seated',
        capacity: rows,
        seats: Array.from({ length: rows }, (_, i) => ({
          id: `seat-${i}`,
          row: String(i),
          number: '1',
          x: -100,
          y: -200 + i * spacing,
        })),
      },
    ],
  };
}

describe('selection map viewport', () => {
  it('fits a two-row map without hundreds of pixels of unused space at either coordinate scale', () => {
    for (const spacing of [30, 56]) {
      const height = selectionMapHeight(layout(2, spacing), 844);
      expect(height).toBeGreaterThanOrEqual(112);
      expect(height).toBeLessThan(200);
    }
  });

  it('gives tall maps a bounded viewport and preserves space for the legend and footer on short screens', () => {
    const tall = layout(500, 30);
    const phone = selectionMapHeight(tall, 640);
    const tablet = selectionMapHeight(tall, 1200);
    expect(phone).toBeGreaterThanOrEqual(160);
    expect(phone).toBeLessThanOrEqual(640 * 0.4);
    expect(tablet).toBeGreaterThan(phone);
    expect(tablet).toBeLessThanOrEqual(360);
  });

  it('has a finite usable height while no seated zone is selected', () => {
    expect(selectionMapHeight({ version: 1, zones: [] }, 640)).toBeGreaterThanOrEqual(160);
  });
});
