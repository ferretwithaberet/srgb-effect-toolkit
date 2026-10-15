import { rgbToHsl } from '../runtime/color';
import type { AreaMeter, LinearMeter, MeterDef, Range } from '../shared';

/** Meters whose value the devtools can compute from captured pixels. */
export type HslMeter = LinearMeter | AreaMeter;

export const isHslMeter = (meter: MeterDef): meter is HslMeter =>
  meter.type === 'linear' || meter.type === 'area';

/** A meter's region in normalized 0–1 screen coordinates. `height` is 0 for linear meters. */
export interface MeterRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A region in whole pixels, inside the frame. */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Relative tolerance when matching a screen to a resolution's `aspect`; marketing ratios are rounded. */
const ASPECT_TOLERANCE = 0.03;

const parsePair = (value: string, separator: string): [number, number] => {
  const [a = '0', b = '0'] = value.split(separator);
  return [Number(a), Number(b)];
};

/**
 * The meter's region for a `screenWidth`×`screenHeight` screen: the first resolution whose `size`
 * matches exactly, else the first whose `aspect` matches within 3% (so 3440×1440 counts as 21:9), merged over the meter's own
 * region; the meter's region when none matches.
 */
export function resolveMeterRegion(
  meter: MeterDef,
  screenWidth: number,
  screenHeight: number,
): MeterRegion {
  const base: MeterRegion = {
    x: meter.x,
    y: meter.y,
    width: meter.width,
    height: meter.type === 'linear' ? 0 : meter.height,
  };
  const resolutions = meter.resolutions ?? [];
  const ratio = screenWidth / screenHeight;
  const match =
    resolutions.find((r) => {
      if (r.size === undefined) return false;
      const [w, h] = parsePair(r.size, 'x');
      return w === screenWidth && h === screenHeight;
    }) ??
    resolutions.find((r) => {
      if (r.aspect === undefined) return false;
      const [w, h] = parsePair(r.aspect, ':');
      return Math.abs(ratio - w / h) <= (w / h) * ASPECT_TOLERANCE;
    });
  if (!match) return base;
  return {
    x: match.x ?? base.x,
    y: match.y ?? base.y,
    width: match.width ?? base.width,
    height: meter.type === 'linear' ? 0 : (match.height ?? base.height),
  };
}

/**
 * Converts a normalized region to pixels in a `width`×`height` frame. Linear meters are one row
 * high; every rect is at least 1×1 and clipped to the frame.
 */
export function toPixelRect(
  region: MeterRegion,
  linear: boolean,
  width: number,
  height: number,
): PixelRect {
  const x = Math.min(width - 1, Math.max(0, Math.floor(region.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(region.y * height)));
  const w = Math.max(1, Math.round(region.width * width));
  const h = linear ? 1 : Math.max(1, Math.round(region.height * height));
  return { x, y, width: Math.min(w, width - x), height: Math.min(h, height - y) };
}

const within = (value: number, [min, max]: Range) => value >= min && value <= max;

/**
 * Fraction (0–1) of the pixels in `rect` whose HSL falls inside the meter's `h`, `s` and `l`
 * ranges (inclusive). `hdr` ranges are not simulated.
 */
export function evaluateHslMeter(
  meter: HslMeter,
  pixels: ArrayLike<number>,
  width: number,
  rect: PixelRect,
): number {
  let matches = 0;
  const total = rect.width * rect.height;
  if (total <= 0) return 0;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const offset = (y * width + x) * 4;
      const { h, s, l } = rgbToHsl({
        r: pixels[offset]!,
        g: pixels[offset + 1]!,
        b: pixels[offset + 2]!,
      });
      if (within(h, meter.h) && within(s, meter.s) && within(l, meter.l)) matches += 1;
    }
  }
  return matches / total;
}

/**
 * Restricts a manual value to what the meter type can report: 0–1 for `linear` and `area`,
 * -1, 0 or 1 for `ocr_textmatch`, an integer ≥ -1 for `ocr_numeric`. NaN becomes the type's
 * "nothing found" value (0, 0 and -1); infinite `ocr_numeric` values become -1 too.
 */
export function clampMeterValue(meter: MeterDef, value: number): number {
  switch (meter.type) {
    case 'linear':
    case 'area':
      return Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
    case 'ocr_textmatch':
      return Number.isNaN(value) ? 0 : Math.min(1, Math.max(-1, Math.round(value)));
    case 'ocr_numeric':
      return Number.isFinite(value) ? Math.max(-1, Math.round(value)) : -1;
  }
}
