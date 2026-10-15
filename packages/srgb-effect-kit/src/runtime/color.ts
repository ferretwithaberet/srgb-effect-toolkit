/** RGB color with channels from 0 to 255. */
export interface Rgb {
  /** 0–255 */
  r: number;
  /** 0–255 */
  g: number;
  /** 0–255 */
  b: number;
}

/** HSL color: hue in degrees, saturation and lightness in percent. */
export interface Hsl {
  /** 0–360 */
  h: number;
  /** 0–100 */
  s: number;
  /** 0–100 */
  l: number;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Parses `#rrggbb` or `#rgb` (the `#` is optional, any case).
 * @throws Error `[srgb-effect] invalid hex color "<hex>"` for anything else.
 */
export function hexToRgb(hex: string): Rgb {
  const match = HEX.exec(hex);
  if (!match) throw new Error(`[srgb-effect] invalid hex color "${hex}"`);
  let digits = match[1]!;
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
  const value = Number.parseInt(digits, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

/** Formats lowercase `#rrggbb`. Channels are clamped to 0–255 and rounded. */
export const rgbToHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b]
    .map((c) =>
      Math.round(clamp(c, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;

/** Converts RGB to HSL, rounding each component to one decimal. Greys get `h: 0, s: 0`. */
export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: round1(l * 100) };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h = (h * 60 + 360) % 360;
  return { h: round1(h), s: round1(s * 100), l: round1(l * 100) };
}

/** Converts HSL to RGB with integer channels. Hue wraps around 360; `s` and `l` clamp to 0–100. */
export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = ln - chroma / 2;
  const [r1, g1, b1] =
    hue < 60
      ? [chroma, x, 0]
      : hue < 120
        ? [x, chroma, 0]
        : hue < 180
          ? [0, chroma, x]
          : hue < 240
            ? [0, x, chroma]
            : hue < 300
              ? [x, 0, chroma]
              : [chroma, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/** `rgbToHsl(hexToRgb(hex))`. Throws on invalid hex like `hexToRgb()`. */
export const hexToHsl = (hex: string): Hsl => rgbToHsl(hexToRgb(hex));
/** `rgbToHex(hslToRgb(value))`. */
export const hslToHex = (value: Hsl): string => rgbToHex(hslToRgb(value));

/**
 * Builds a CSS `hsl()` string, or `hsla()` when `a` is given, using the comma syntax that older
 * engines understand. Values are not clamped.
 * @example hsl(200, 100, 50) // 'hsl(200, 100%, 50%)'
 */
export const hsl = (h: number, s: number, l: number, a?: number): string =>
  a === undefined ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${a})`;

/**
 * Builds a CSS `rgb()` string, or `rgba()` when `a` is given, using the comma syntax. Values are
 * not clamped.
 * @example rgb(255, 0, 0, 0.5) // 'rgba(255, 0, 0, 0.5)'
 */
export const rgb = (r: number, g: number, b: number, a?: number): string =>
  a === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;

/**
 * Interpolates between two hex colors in RGB space and returns lowercase `#rrggbb`.
 * `t` is clamped to 0–1. Throws on invalid hex like `hexToRgb()`.
 * @example lerpColor('#000000', '#ffffff', 0.5) // '#808080'
 */
export function lerpColor(from: string, to: string, t: number): string {
  const amount = clamp(t, 0, 1);
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}
