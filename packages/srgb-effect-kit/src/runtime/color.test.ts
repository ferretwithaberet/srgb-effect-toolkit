import { describe, expect, it } from 'vitest';
import {
  hexToHsl,
  hexToRgb,
  hsl,
  hslToHex,
  hslToRgb,
  lerpColor,
  rgb,
  rgbToHex,
  rgbToHsl,
} from './color';

describe('hex <-> rgb', () => {
  it('parses 6- and 3-digit hex in any case', () => {
    expect(hexToRgb('#009bde')).toEqual({ r: 0, g: 155, b: 222 });
    expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('throws on invalid hex', () => {
    expect(() => hexToRgb('red')).toThrow('[srgb-effect] invalid hex color "red"');
  });

  it('formats lowercase hex, rounding and clamping', () => {
    expect(rgbToHex({ r: 0, g: 155, b: 222 })).toBe('#009bde');
    expect(rgbToHex({ r: 300, g: -5, b: 127.6 })).toBe('#ff0080');
  });
});

describe('rgb <-> hsl', () => {
  it('converts primaries and greys', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
    expect(rgbToHsl({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, l: 50.2 });
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(hslToRgb({ h: 0, s: 0, l: 100 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('wraps hue and round-trips through hex', () => {
    expect(hslToRgb({ h: 480, s: 100, l: 50 })).toEqual(hslToRgb({ h: 120, s: 100, l: 50 }));
    expect(hslToRgb({ h: -120, s: 100, l: 50 })).toEqual(hslToRgb({ h: 240, s: 100, l: 50 }));
    expect(hslToHex(hexToHsl('#009bde'))).toBe('#009bde');
  });
});

describe('css string builders', () => {
  it('uses comma syntax for older engines', () => {
    expect(hsl(200, 100, 50)).toBe('hsl(200, 100%, 50%)');
    expect(hsl(200, 100, 50, 0.5)).toBe('hsla(200, 100%, 50%, 0.5)');
    expect(rgb(1, 2, 3)).toBe('rgb(1, 2, 3)');
    expect(rgb(1, 2, 3, 0)).toBe('rgba(1, 2, 3, 0)');
  });
});

describe('lerpColor', () => {
  it('interpolates in rgb and clamps t', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lerpColor('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(lerpColor('#ff0000', '#0000ff', 2)).toBe('#0000ff');
  });
});
