import { layoutBounds, seatGeometry, type LayoutData } from '@event/seat-map';

/** Keep small layouts compact without shrinking the renderer's 48px seat targets. */
export function selectionMapHeight(layout: LayoutData, screenHeight: number): number {
  const bounds = layoutBounds(layout);
  const geometry = seatGeometry(layout);
  const contentHeight = (bounds.maxY - bounds.minY) * geometry.initialZoom + 64;
  const maximum = Math.max(160, Math.min(360, screenHeight * 0.4));
  return Math.ceil(Math.max(160, Math.min(maximum, contentHeight)));
}
