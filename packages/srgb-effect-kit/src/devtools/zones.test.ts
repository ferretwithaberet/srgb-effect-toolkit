import { describe, expect, it } from 'vitest';
import { getZone } from '../runtime/zones';
import { createEngineMock } from './engine';
import { fillGradientZones, fillSolidZones, sampleZones, ZONE_COUNT } from './zones';

/** RGBA pixels where `color(x, y)` gives each pixel's RGB. */
const image = (width: number, height: number, color: (x: number, y: number) => number[]) => {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) pixels.set([...color(x, y), 255], (y * width + x) * 4);
  }
  return pixels;
};

describe('zone simulation', () => {
  it('fills every cell with a solid color', () => {
    const { zone } = createEngineMock();
    fillSolidZones(zone, '#ff0000');
    expect(zone.hue).toHaveLength(ZONE_COUNT);
    expect(getZone(0, 0, zone)).toEqual({ h: 0, s: 100, l: 50 });
    expect(getZone(27, 19, zone)).toEqual({ h: 0, s: 100, l: 50 });
  });

  it('fills a left-to-right gradient', () => {
    const { zone } = createEngineMock();
    fillGradientZones(zone, '#000000', '#ffffff');
    expect(getZone(0, 5, zone).l).toBe(0);
    expect(getZone(27, 5, zone).l).toBe(100);
    expect(getZone(13, 0, zone)).toEqual(getZone(13, 19, zone));
    expect(getZone(13, 0, zone).l).toBeGreaterThan(40);
    expect(getZone(13, 0, zone).l).toBeLessThan(60);
  });

  it('averages captured pixels per cell', () => {
    const { zone } = createEngineMock();
    // Left half red, right half blue, on a 56×40 frame (2×2 pixels per cell).
    sampleZones(
      zone,
      image(56, 40, (x) => (x < 28 ? [255, 0, 0] : [0, 0, 255])),
      56,
      40,
    );
    expect(getZone(0, 0, zone)).toEqual({ h: 0, s: 100, l: 50 });
    expect(getZone(13, 19, zone)).toEqual({ h: 0, s: 100, l: 50 });
    expect(getZone(14, 0, zone)).toEqual({ h: 240, s: 100, l: 50 });
  });

  it('averages mixed pixels and handles frames smaller than the grid', () => {
    const { zone } = createEngineMock();
    // Alternating black and white columns average to mid grey.
    sampleZones(
      zone,
      image(56, 40, (x) => (x % 2 ? [255, 255, 255] : [0, 0, 0])),
      56,
      40,
    );
    expect(getZone(3, 3, zone).l).toBe(50);

    sampleZones(
      zone,
      image(4, 2, () => [0, 255, 0]),
      4,
      2,
    );
    expect(getZone(27, 19, zone)).toEqual({ h: 120, s: 100, l: 50 });
  });
});
