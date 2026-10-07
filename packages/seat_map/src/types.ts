// Layout JSON schema (MT §22, proposed; S0-FE3-2 finalises it with BE1).

export interface LayoutSeat {
  id: string;
  row: string;
  number: string;
  x: number;
  y: number;
  flags?: string[];
}

export interface SeatedZone {
  id: string;
  name: string;
  type: 'seated';
  capacity: number;
  seats: LayoutSeat[];
}

export interface StandingZone {
  id: string;
  name: string;
  type: 'standing';
  capacity: number;
}

export type LayoutZone = SeatedZone | StandingZone;

export interface LayoutData {
  version: number;
  zones: LayoutZone[];
}

export type SeatState = 'AVAILABLE' | 'LOCKED' | 'SOLD' | 'BLOCKED' | 'HELD';
export type SeatMapMode = 'select' | 'edit' | 'view';

/** One component API, three modes, two renderers (web Canvas 2D, native Skia). No Supabase calls. */
export interface SeatMapProps {
  layout: LayoutData;
  seatStates: Record<string, SeatState>;
  selectedSeatIds?: ReadonlySet<string>;
  /** Defaults to 'select'. */
  mode?: SeatMapMode;
  onSeatPress?: (seatId: string) => void;
  /** Edit mode only. */
  onLayoutChange?: (layout: LayoutData) => void;
}

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}
