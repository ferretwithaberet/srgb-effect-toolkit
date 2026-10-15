import { describe, expect, it } from 'vitest';
import { MANIFEST } from '../../test/helpers/devtools';
import {
  clampMeterValue,
  evaluateHslMeter,
  isHslMeter,
  resolveMeterRegion,
  toPixelRect,
} from './meters';

const [health, mana, victory, score] = MANIFEST.meters;

describe('meter regions', () => {
  it('uses the meter region when no resolution matches', () => {
    expect(resolveMeterRegion(health, 1280, 720)).toEqual({
      x: 0.1,
      y: 0.5,
      width: 0.5,
      height: 0,
    });
    expect(resolveMeterRegion(mana, 1280, 720)).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
  });

  it('merges an exact size override', () => {
    expect(resolveMeterRegion(mana, 1920, 1080)).toEqual({
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 0.5,
    });
  });

  it('matches aspect overrides within 3%, after exact sizes', () => {
    const meter = {
      ...mana,
      resolutions: [
        { aspect: '21:9', x: 0.25 },
        { size: '2560x1080', x: 0.4 },
      ],
    } as const;
    expect(resolveMeterRegion(meter, 2560, 1080).x).toBe(0.4);
    expect(resolveMeterRegion(meter, 3440, 1440).x).toBe(0.25);
    expect(resolveMeterRegion(meter, 1920, 1080).x).toBe(0);
  });

  it('converts regions to pixel rects inside the frame', () => {
    expect(toPixelRect({ x: 0.1, y: 0.5, width: 0.5, height: 0 }, true, 100, 50)).toEqual({
      x: 10,
      y: 25,
      width: 50,
      height: 1,
    });
    expect(toPixelRect({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 }, false, 100, 50)).toEqual({
      x: 90,
      y: 45,
      width: 10,
      height: 5,
    });
    expect(toPixelRect({ x: 1, y: 1, width: 0, height: 0 }, false, 10, 10)).toEqual({
      x: 9,
      y: 9,
      width: 1,
      height: 1,
    });
  });
});

describe('evaluateHslMeter', () => {
  it('returns the fraction of pixels inside the HSL ranges', () => {
    // 4×1 frame: two green pixels (h 120) inside health's ranges, one red, one grey.
    const pixels = new Uint8ClampedArray([
      0, 255, 0, 255, 0, 200, 0, 255, 255, 0, 0, 255, 128, 128, 128, 255,
    ]);
    expect(evaluateHslMeter(health, pixels, 4, { x: 0, y: 0, width: 4, height: 1 })).toBe(0.5);
    expect(evaluateHslMeter(health, pixels, 4, { x: 0, y: 0, width: 2, height: 1 })).toBe(1);
    expect(evaluateHslMeter(health, pixels, 4, { x: 0, y: 0, width: 0, height: 1 })).toBe(0);
  });

  it('only applies to linear and area meters', () => {
    expect(MANIFEST.meters.map(isHslMeter)).toEqual([true, true, false, false]);
  });
});

describe('clampMeterValue', () => {
  it('limits manual values to what each meter type reports', () => {
    expect(clampMeterValue(health, 1.5)).toBe(1);
    expect(clampMeterValue(mana, -1)).toBe(0);
    expect(clampMeterValue(mana, Number.NaN)).toBe(0);
    expect(clampMeterValue(victory, 0.6)).toBe(1);
    expect(clampMeterValue(victory, -7)).toBe(-1);
    expect(clampMeterValue(victory, Number.NaN)).toBe(0);
    expect(clampMeterValue(score, 41.6)).toBe(42);
    expect(clampMeterValue(score, -5)).toBe(-1);
    expect(clampMeterValue(score, Number.POSITIVE_INFINITY)).toBe(-1);
  });
});
