import { afterEach, describe, expect, it } from 'vitest';
import { ZONE_COLUMNS, ZONE_ROWS, getZone, getZones } from './zones';

const grid = (fn: (i: number) => number) =>
  Array.from({ length: ZONE_COLUMNS * ZONE_ROWS }, (_, i) => fn(i));
const zone = {
  hue: grid((i) => i % 360),
  saturation: grid(() => 50),
  lightness: grid((i) => i % 101),
};

afterEach(() => {
  delete (globalThis as { engine?: unknown }).engine;
});

describe('getZone', () => {
  it('reads the row-major 28×20 grid', () => {
    expect(getZone(0, 0, zone)).toEqual({ h: 0, s: 50, l: 0 });
    expect(getZone(27, 0, zone)).toEqual({ h: 27, s: 50, l: 27 });
    expect(getZone(1, 1, zone)).toEqual({ h: 29, s: 50, l: 29 });
  });

  it('throws on out-of-range coordinates', () => {
    expect(() => getZone(28, 0, zone)).toThrow(RangeError);
    expect(() => getZone(0, 20, zone)).toThrow(RangeError);
    expect(() => getZone(-1, 0, zone)).toThrow(RangeError);
    expect(() => getZone(1.5, 0, zone)).toThrow(RangeError);
  });

  it('returns black when no zone data exists', () => {
    expect(getZone(3, 3)).toEqual({ h: 0, s: 0, l: 0 });
  });

  it('reads the engine global by default', () => {
    (globalThis as { engine?: unknown }).engine = { zone };
    expect(getZone(2, 0)).toEqual({ h: 2, s: 50, l: 2 });
  });
});

describe('getZones', () => {
  it('returns all 560 zones in row-major order', () => {
    const zones = getZones(zone);
    expect(zones).toHaveLength(560);
    expect(zones[29]).toEqual({ h: 29, s: 50, l: 29 });
  });
});
