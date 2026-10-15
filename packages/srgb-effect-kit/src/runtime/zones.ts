import { getEngine } from './engine';
import type { EngineZone } from './types';

export const ZONE_COLUMNS = 28;
export const ZONE_ROWS = 20;

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

/** Screen color of one cell in SignalRGB's 28×20 grid (row-major, origin top-left). */
export function getZone(
  x: number,
  y: number,
  zone: Partial<EngineZone> | undefined = getEngine()?.zone,
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

export function getZones(zone: Partial<EngineZone> | undefined = getEngine()?.zone): ZoneColor[] {
  return Array.from({ length: ZONE_COLUMNS * ZONE_ROWS }, (_, index) => read(zone, index));
}
