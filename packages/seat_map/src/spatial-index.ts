import type { LayoutData, LayoutSeat, Viewport } from './types';

export interface IndexedSeat extends LayoutSeat {
  zoneId: string;
}

/**
 * Uniform grid over seat coordinates: viewport culling and hit-testing stay O(cells touched)
 * instead of O(seats), which is what keeps 50.000-seat layouts usable (NFR-04).
 */
export class SeatGridIndex {
  private readonly cells = new Map<string, IndexedSeat[]>();
  private readonly cellSize: number;

  constructor(layout: LayoutData, cellSize = 50) {
    this.cellSize = cellSize;
    for (const zone of layout.zones) {
      if (zone.type !== 'seated') continue;
      for (const seat of zone.seats) {
        const key = this.key(this.cell(seat.x), this.cell(seat.y));
        let bucket = this.cells.get(key);
        if (!bucket) this.cells.set(key, (bucket = []));
        bucket.push({ ...seat, zoneId: zone.id });
      }
    }
  }

  /** Seats whose centre lies inside the viewport: the only ones a renderer should draw. */
  query(view: Viewport): IndexedSeat[] {
    const out: IndexedSeat[] = [];
    for (let cx = this.cell(view.x); cx <= this.cell(view.x + view.width); cx++) {
      for (let cy = this.cell(view.y); cy <= this.cell(view.y + view.height); cy++) {
        for (const s of this.cells.get(this.key(cx, cy)) ?? []) {
          if (s.x >= view.x && s.x <= view.x + view.width && s.y >= view.y && s.y <= view.y + view.height) {
            out.push(s);
          }
        }
      }
    }
    return out;
  }

  /** Nearest seat within `radius` of a tap / click, in layout coordinates. */
  hitTest(x: number, y: number, radius: number): IndexedSeat | null {
    let best: IndexedSeat | null = null;
    let bestDist = radius * radius;
    for (const s of this.query({ x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 })) {
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d <= bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return best;
  }

  private cell(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  private key(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }
}
