import { SeatGridIndex, type IndexedSeat } from './spatial-index';
import type { LayoutData, SeatMapProps, SeatState, Viewport } from './types';

export type DisplaySeatState = SeatState | 'SELECTED' | 'CONFLICT';
export function displaySeatState(
  id: string,
  states: SeatMapProps['seatStates'],
  selected?: ReadonlySet<string>,
  conflicts?: ReadonlySet<string>,
): DisplaySeatState {
  if (conflicts?.has(id)) return 'CONFLICT';
  if (selected?.has(id)) return 'SELECTED';
  return states[id] ?? 'AVAILABLE';
}
export function visibleSeats(index: SeatGridIndex, viewport: Viewport, margin = 28): IndexedSeat[] {
  return index.query({
    x: viewport.x - margin,
    y: viewport.y - margin,
    width: viewport.width + margin * 2,
    height: viewport.height + margin * 2,
  });
}
export function layoutBounds(layout: LayoutData) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const zone of layout.zones)
    if (zone.type === 'seated')
      for (const seat of zone.seats) {
        minX = Math.min(minX, seat.x);
        minY = Math.min(minY, seat.y);
        maxX = Math.max(maxX, seat.x);
        maxY = Math.max(maxY, seat.y);
      }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : { minX: 0, minY: 0, maxX: 0, maxY: 0 };
}
