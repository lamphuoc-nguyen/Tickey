import { validateLayout, type LayoutData, type LayoutZone } from '@event/seat-map';

// MVP layout editor (MT §22): every seated zone is a rows × seats grid, every standing zone a capacity.
// Zones are stacked vertically so their seat coordinates never overlap on the customer seat map.

export interface EditorZone {
  id: string;
  name: string;
  type: 'seated' | 'standing';
  rows: number;
  seatsPerRow: number;
  capacity: number;
}

export type VenueTemplateType = 'stadium' | 'theater' | 'cinema' | 'standing';

export const SPACING = 30;
const ZONE_GAP = 60;
const ZONE_COLORS = ['#E2553B', '#2F6FEB', '#1B7956', '#946018', '#7C3AED', '#0E7490'];

export const LAYOUT_TEMPLATES: { id: VenueTemplateType; label: string; desc: string; zones: EditorZone[] }[] = [
  {
    id: 'stadium',
    label: 'Sân vận động',
    desc: 'Khán đài, tầng và từng khu ghế.',
    zones: ['A', 'B', 'C', 'D'].map((code) => ({
      id: code,
      name: `Khán đài ${code}`,
      type: 'seated' as const,
      rows: 6,
      seatsPerRow: 10,
      capacity: 0,
    })),
  },
  {
    id: 'theater',
    label: 'Nhà hát',
    desc: 'Sân khấu, khu ghế và hàng ghế.',
    zones: [
      { id: 'A', name: 'Khu A', type: 'seated', rows: 8, seatsPerRow: 10, capacity: 0 },
      { id: 'B', name: 'Khu B', type: 'seated', rows: 6, seatsPerRow: 12, capacity: 0 },
    ],
  },
  {
    id: 'cinema',
    label: 'Rạp phim',
    desc: 'Màn chiếu, phòng chiếu và lối đi.',
    zones: [{ id: 'P1', name: 'Phòng chiếu 01', type: 'seated', rows: 7, seatsPerRow: 12, capacity: 0 }],
  },
  {
    id: 'standing',
    label: 'Không có ghế',
    desc: 'Khu vực mở/sức chứa, không đánh số ghế.',
    zones: [{ id: 'GA', name: 'Khu đứng', type: 'standing', rows: 0, seatsPerRow: 0, capacity: 200 }],
  },
];

export function detectTemplateType(zones: EditorZone[]): VenueTemplateType {
  if (!zones || zones.length === 0) return 'stadium';
  if (zones.every((z) => z.type === 'standing')) return 'standing';
  const hasStadiumName = zones.some((z) => z.name.toLowerCase().includes('khán đài'));
  const hasStadiumIds = zones.length === 4 && ['A', 'B', 'C', 'D'].every((id) => zones.some((z) => z.id === id));
  if (hasStadiumName || hasStadiumIds) return 'stadium';
  if (
    zones.length === 1 &&
    (zones[0].name.toLowerCase().includes('phòng') ||
      zones[0].name.toLowerCase().includes('chiếu') ||
      zones[0].id.startsWith('P'))
  ) {
    return 'cinema';
  }
  if (zones.length >= 2 && zones.every((z) => z.type === 'seated')) {
    return 'theater';
  }
  return zones[0]?.type === 'standing' ? 'standing' : 'theater';
}

export function createTemplateZones(type: VenueTemplateType): EditorZone[] {
  const found = LAYOUT_TEMPLATES.find((t) => t.id === type);
  return found ? found.zones.map((z) => ({ ...z })) : [];
}

/** A, B, …, Z, AA, AB … */
export function rowLabel(index: number): string {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
    label = String.fromCharCode(65 + ((n - 1) % 26)) + label;
  return label;
}

export function zoneCapacity(zone: EditorZone): number {
  return zone.type === 'seated' ? zone.rows * zone.seatsPerRow : zone.capacity;
}

/** Editor zones → the layout JSON that save_layout_draft / publish_layout_version validate. */
export function toDefinition(zones: EditorZone[]): LayoutData {
  let top = 0;
  const layoutZones: LayoutZone[] = zones.map((zone, index) => {
    const color = ZONE_COLORS[index % ZONE_COLORS.length];
    if (zone.type === 'standing') {
      return { id: zone.id, name: zone.name, type: 'standing', capacity: zone.capacity, color };
    }
    const seats = [];
    for (let r = 0; r < zone.rows; r++) {
      for (let c = 1; c <= zone.seatsPerRow; c++) {
        seats.push({
          id: `${zone.id}-${rowLabel(r)}${c}`,
          row: rowLabel(r),
          number: String(c),
          x: c * SPACING,
          y: top + r * SPACING,
        });
      }
    }
    top += zone.rows * SPACING + ZONE_GAP;
    return { id: zone.id, name: zone.name, type: 'seated', capacity: seats.length, seats, color };
  });
  return { version: 1, zones: layoutZones };
}

/** A saved definition back into editable zones (irregular seat plans become their bounding grid). */
export function fromDefinition(definition: LayoutData | null | undefined): EditorZone[] {
  return (definition?.zones ?? []).map((zone) => {
    if (zone.type === 'standing') {
      return {
        id: zone.id,
        name: zone.name,
        type: 'standing',
        rows: 0,
        seatsPerRow: 0,
        capacity: zone.capacity,
      };
    }
    const rows = new Map<string, number>();
    for (const seat of zone.seats ?? []) rows.set(seat.row, (rows.get(seat.row) ?? 0) + 1);
    return {
      id: zone.id,
      name: zone.name,
      type: 'seated',
      rows: rows.size,
      seatsPerRow: Math.max(0, ...rows.values()),
      capacity: 0,
    };
  });
}

export function definitionErrors(zones: EditorZone[], venueCapacity: number): string[] {
  const errors = validateLayout(toDefinition(zones)).map((error) => `Sơ đồ: ${error}`);
  if (!zones.length) errors.push('Sơ đồ cần ít nhất một khu vực.');
  for (const zone of zones) {
    if (!zone.id.trim() || !zone.name.trim()) errors.push('Mỗi khu vực cần mã và tên.');
    if (zone.type === 'seated' && (zone.rows < 1 || zone.seatsPerRow < 1))
      errors.push(`Khu ${zone.name || zone.id}: cần ít nhất 1 hàng và 1 ghế mỗi hàng.`);
    if (zone.type === 'standing' && zone.capacity < 1)
      errors.push(`Khu ${zone.name || zone.id}: sức chứa phải lớn hơn 0.`);
  }
  const total = zones.reduce((sum, zone) => sum + zoneCapacity(zone), 0);
  if (total > venueCapacity)
    errors.push(
      `Tổng sức chứa ${total} vượt sức chứa địa điểm (${venueCapacity}). Tăng sức chứa địa điểm hoặc bớt ghế.`,
    );
  return [...new Set(errors)];
}
