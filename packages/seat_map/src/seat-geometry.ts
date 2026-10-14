import type { LayoutData } from './types';
/** Layout coordinates may use a 30-unit grid; Material's initial visual cell remains 48px. */
export function seatGeometry(layout: LayoutData) {
  let spacing = Infinity;
  for (const zone of layout.zones) {
    if (zone.type !== 'seated') continue;
    const sample = zone.seats.slice(0, 1000);
    for (const axis of ['x', 'y'] as const) {
      const values = [...new Set(sample.map((seat) => seat[axis]))].sort((a, b) => a - b);
      for (let i = 1; i < values.length; i++) {
        const delta = values[i]! - values[i - 1]!;
        if (delta > 0) spacing = Math.min(spacing, delta);
      }
    }
  }
  if (!Number.isFinite(spacing)) spacing = 56;
  return { diameter: (spacing * 48) / 56, initialZoom: 56 / spacing };
}
