import { hexToRgb, lerpColor, rgbToHsl, type Hsl, type Rgb } from '../runtime/color';
import { ZONE_COLUMNS, ZONE_ROWS } from '../runtime/zones';
import type { MockZone } from './engine';

/** Cells in the 28×20 grid. */
export const ZONE_COUNT = ZONE_COLUMNS * ZONE_ROWS;

const write = (zone: MockZone, index: number, { h, s, l }: Hsl) => {
  zone.hue[index] = h;
  zone.saturation[index] = s;
  zone.lightness[index] = l;
};

/**
 * Fills every cell with one color. Zone values use the meters' scale: hue 0–360, saturation and
 * lightness 0–100 (provisional until probed on SignalRGB).
 */
export function fillSolidZones(zone: MockZone, hex: string): void {
  const hsl = rgbToHsl(hexToRgb(hex));
  for (let i = 0; i < ZONE_COUNT; i += 1) write(zone, i, hsl);
}

/** Fills the grid with a left-to-right gradient: column 0 is `from`, column 27 is `to`. */
export function fillGradientZones(zone: MockZone, from: string, to: string): void {
  for (let x = 0; x < ZONE_COLUMNS; x += 1) {
    const hsl = rgbToHsl(hexToRgb(lerpColor(from, to, x / (ZONE_COLUMNS - 1))));
    for (let y = 0; y < ZONE_ROWS; y += 1) write(zone, y * ZONE_COLUMNS + x, hsl);
  }
}

/**
 * Downsamples RGBA pixels (`width`×`height`, row-major) to the 28×20 grid: each cell takes the
 * average RGB of the pixels it covers (alpha ignored), at least one pixel per cell.
 */
export function sampleZones(
  zone: MockZone,
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) return;
  for (let cy = 0; cy < ZONE_ROWS; cy += 1) {
    const y0 = Math.min(height - 1, Math.floor((cy * height) / ZONE_ROWS));
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * height) / ZONE_ROWS));
    for (let cx = 0; cx < ZONE_COLUMNS; cx += 1) {
      const x0 = Math.min(width - 1, Math.floor((cx * width) / ZONE_COLUMNS));
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / ZONE_COLUMNS));
      const sum: Rgb = { r: 0, g: 0, b: 0 };
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const offset = (y * width + x) * 4;
          sum.r += pixels[offset]!;
          sum.g += pixels[offset + 1]!;
          sum.b += pixels[offset + 2]!;
          count += 1;
        }
      }
      write(
        zone,
        cy * ZONE_COLUMNS + cx,
        rgbToHsl({ r: sum.r / count, g: sum.g / count, b: sum.b / count }),
      );
    }
  }
}
