import type { EngineZone } from './globals';

/** Columns in SignalRGB's screen-zone grid. */
export const ZONE_COLUMNS = 28;
/** Rows in SignalRGB's screen-zone grid. */
export const ZONE_ROWS = 20;

/** Color of one screen zone, read from `engine.zone.hue`, `saturation` and `lightness`. */
export interface ZoneColor {
  h: number;
  s: number;
  l: number;
}

const read = (zone: Partial<EngineZone> | undefined, index: number): ZoneColor => ({
  h: zone?.hue?.[index] ?? 0,
  s: zone?.saturation?.[index] ?? 0,
  l: zone?.lightness?.[index] ?? 0,
});

/**
 * Screen color of one cell in SignalRGB's 28×20 grid (row-major, origin top-left). Missing data
 * reads as 0, so outside SignalRGB every cell is `{ h: 0, s: 0, l: 0 }`.
 *
 * @param x - Column, an integer from 0 to 27.
 * @param y - Row, an integer from 0 to 19.
 * @param zone - Defaults to `engine.zone`.
 * @throws RangeError when `x` or `y` is not an integer inside the grid.
 */
export function getZone(
  x: number,
  y: number,
  zone: Partial<EngineZone> | undefined = globalThis.engine?.zone,
): ZoneColor {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= ZONE_COLUMNS ||
    y < 0 ||
    y >= ZONE_ROWS
  ) {
    throw new RangeError(
      `[srgb-effect] getZone: (${x}, ${y}) is outside the ${ZONE_COLUMNS}×${ZONE_ROWS} grid`,
    );
  }
  return read(zone, y * ZONE_COLUMNS + x);
}

/**
 * All 560 cells of the 28×20 grid in row-major order (index `y * 28 + x`). Missing data reads as 0.
 *
 * @param zone - Defaults to `engine.zone`.
 */
export function getZones(
  zone: Partial<EngineZone> | undefined = globalThis.engine?.zone,
): ZoneColor[] {
  return Array.from({ length: ZONE_COLUMNS * ZONE_ROWS }, (_, index) => read(zone, index));
}
