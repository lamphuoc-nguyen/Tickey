import type { LayoutData } from './types';

/**
 * Client-side pre-check for the layout editor. The server validates again (S1-BE1-1):
 * this only gives the editor fast feedback.
 */
export function validateLayout(layout: LayoutData): string[] {
  const errors: string[] = [];
  const zoneIds = new Set<string>();
  const seatIds = new Set<string>();

  for (const zone of layout.zones) {
    if (zoneIds.has(zone.id)) errors.push(`Duplicate zone id: ${zone.id}`);
    zoneIds.add(zone.id);
    if (zone.capacity <= 0) errors.push(`Zone ${zone.id}: capacity must be positive`);
    if (zone.type !== 'seated') continue;

    for (const seat of zone.seats) {
      if (seatIds.has(seat.id)) errors.push(`Duplicate seat id: ${seat.id}`);
      seatIds.add(seat.id);
    }
    if (zone.seats.length > zone.capacity) {
      errors.push(`Zone ${zone.id}: ${zone.seats.length} seats exceed capacity ${zone.capacity}`);
    }
  }
  return errors;
}

/** Row × column grid generator for the MVP layout editor (MT §22). */
export function generateSeatGrid(
  zoneId: string,
  rows: number,
  cols: number,
  spacing = 30,
): { id: string; row: string; number: string; x: number; y: number }[] {
  const seats = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      seats.push({
        id: `${zoneId}-${r}-${c}`,
        row: String(r),
        number: String(c),
        x: (c - 1) * spacing,
        y: (r - 1) * spacing,
      });
    }
  }
  return seats;
}
