import { describe, expect, it } from 'vitest';
import type { EffectManifest, MeterDef, PropertyDef } from './types';
import { ManifestError, assertValidManifest, collectManifestIssues } from './validate';

const withProps = (...properties: PropertyDef[]): EffectManifest => ({ title: 'T', properties });
const withMeters = (...meters: MeterDef[]): EffectManifest => ({ title: 'T', meters });
const linear = (over: Partial<Extract<MeterDef, { type: 'linear' }>> = {}): MeterDef => ({
  meter: 'm',
  type: 'linear',
  x: 0.1,
  y: 0.1,
  width: 0.2,
  h: [0, 360],
  s: [0, 100],
  l: [0, 100],
  ...over,
});
const issues = (m: EffectManifest) => collectManifestIssues(m);

describe('collectManifestIssues', () => {
  it('accepts a valid manifest', () => {
    expect(
      issues({
        title: 'Hue Cycle',
        properties: [
          { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
          { property: 'baseHue', type: 'hue', label: 'Hue', default: 360 },
          { property: 'rainbow', type: 'boolean', label: 'Rainbow', default: true },
          { property: 'tint', type: 'color', label: 'Tint', default: '#00FFaa' },
          { property: 'text', type: 'textfield', label: 'Text', default: '' },
          { property: 'mode', type: 'list', label: 'Mode', values: ['A', 'B'], default: 'B' },
        ],
        meters: [linear({ resolutions: [{ size: '1920x1080', x: 0.5 }, { aspect: '3.55:1' }] })],
      }),
    ).toEqual([]);
  });

  it('rejects an empty title', () => {
    expect(issues({ title: '  ' })).toEqual(['title: must not be empty']);
  });

  describe('property names', () => {
    const num = (property: string): PropertyDef => ({
      property,
      type: 'number',
      label: 'L',
      min: 0,
      max: 1,
      default: 0,
    });

    it('requires valid identifiers', () => {
      expect(issues(withProps(num('my-prop')))[0]).toMatch(
        /properties\[0\] \("my-prop"\): .*identifier/,
      );
    });

    it('rejects duplicates', () => {
      expect(issues(withProps(num('a'), num('a')))).toContainEqual(
        expect.stringMatching(/properties\[1\] \("a"\): duplicate/),
      );
    });

    it('rejects browser and SignalRGB globals', () => {
      for (const name of [
        'name',
        'status',
        'top',
        'length',
        'close',
        'engine',
        'onCanvasApiEvent',
      ]) {
        expect(issues(withProps(num(name)))[0]).toMatch(/collides with a built-in global/);
      }
    });

    it('rejects names whose change handlers collide', () => {
      expect(issues(withProps(num('speed'), num('Speed')))).toContainEqual(
        expect.stringMatching(
          /properties\[1\] \("Speed"\): change handler onSpeedChanged collides with property "speed"/,
        ),
      );
    });

    it('requires a label', () => {
      expect(issues(withProps({ ...num('a'), label: ' ' }))[0]).toMatch(/label must not be empty/);
    });
  });

  it('checks number ranges and integers', () => {
    const base = { property: 'a', type: 'number', label: 'A' } as const;
    expect(issues(withProps({ ...base, min: 0, max: 10, default: 11 }))[0]).toMatch(
      /min ≤ default ≤ max/,
    );
    expect(issues(withProps({ ...base, min: 10, max: 0, default: 5 }))[0]).toMatch(
      /min ≤ default ≤ max/,
    );
    expect(issues(withProps({ ...base, min: 0, max: 10, default: 1.5 }))[0]).toMatch(
      /whole numbers/,
    );
  });

  it('checks hue bounds with defaults 0..360', () => {
    const base = { property: 'h', type: 'hue', label: 'H' } as const;
    expect(issues(withProps({ ...base, default: 361 }))[0]).toMatch(
      /0 ≤ min ≤ default ≤ max ≤ 360/,
    );
    expect(issues(withProps({ ...base, min: -1, default: 0 }))[0]).toMatch(
      /0 ≤ min ≤ default ≤ max ≤ 360/,
    );
  });

  it('checks color hex format', () => {
    expect(
      issues(withProps({ property: 'c', type: 'color', label: 'C', default: 'red' }))[0],
    ).toMatch(/#rrggbb/);
  });

  it('checks list values and default', () => {
    const base = { property: 'l', type: 'list', label: 'L' } as const;
    expect(issues(withProps({ ...base, values: [], default: 'a' }))).toContainEqual(
      expect.stringMatching(/values must not be empty/),
    );
    expect(issues(withProps({ ...base, values: ['a', 'a'], default: 'a' }))[0]).toMatch(
      /duplicate value "a"/,
    );
    expect(issues(withProps({ ...base, values: ['a,b'], default: 'a,b' }))[0]).toMatch(
      /must not contain commas/,
    );
    expect(issues(withProps({ ...base, values: ['a'], default: 'z' }))[0]).toMatch(
      /default "z" is not one of values/,
    );
  });

  describe('meters', () => {
    it('requires identifiers and unique names', () => {
      expect(issues(withMeters(linear({ meter: 'bad name' })))[0]).toMatch(/identifier/);
      expect(issues(withMeters(linear(), linear()))[0]).toMatch(/meters\[1\] \("m"\): duplicate/);
    });

    it('rejects regions outside the screen', () => {
      expect(issues(withMeters(linear({ x: 0.9, width: 0.2 })))[0]).toMatch(
        /x \+ width must be ≤ 1/,
      );
      expect(issues(withMeters(linear({ y: 1.2 })))[0]).toMatch(/y must be between 0 and 1/);
      expect(
        issues(
          withMeters({
            meter: 'a',
            type: 'area',
            x: 0,
            y: 0.95,
            width: 0.1,
            height: 0.1,
            h: [0, 1],
            s: [0, 1],
            l: [0, 1],
          }),
        )[0],
      ).toMatch(/y \+ height must be ≤ 1/);
    });

    it('allows float sums that are exactly 1', () => {
      expect(issues(withMeters(linear({ x: 0.7, width: 0.3 })))).toEqual([]);
    });

    it('checks HSL ranges including hdr', () => {
      expect(issues(withMeters(linear({ h: [0, 400] })))[0]).toMatch(
        /h range must satisfy 0 ≤ min ≤ max ≤ 360/,
      );
      expect(issues(withMeters(linear({ s: [50, 10] })))[0]).toMatch(/s range/);
      expect(issues(withMeters(linear({ hdr: { h: [0, 1], s: [0, 1], l: [0, 101] } })))[0]).toMatch(
        /hdr: l range/,
      );
    });

    it('checks OCR string and confidence', () => {
      const ocr = {
        meter: 'o',
        type: 'ocr_textmatch',
        x: 0,
        y: 0,
        width: 0.1,
        height: 0.1,
      } as const;
      expect(issues(withMeters({ ...ocr, string: '' }))[0]).toMatch(/string must not be empty/);
      expect(issues(withMeters({ ...ocr, string: 'GO', confidence: 101 }))[0]).toMatch(
        /confidence/,
      );
    });

    it('checks resolutions after merging with the base region', () => {
      expect(
        issues(withMeters(linear({ resolutions: [{ size: '1920x1080', x: 0.9 }] })))[0],
      ).toMatch(/resolutions\[0\]: x \+ width must be ≤ 1/);
      expect(
        issues(withMeters(linear({ resolutions: [{ size: '1920*1080' as '1x1' }] })))[0],
      ).toMatch(/size must look like "1920x1080"/);
      expect(issues(withMeters(linear({ resolutions: [{ aspect: '16-9' as '1:1' }] })))[0]).toMatch(
        /aspect must look like "16:9"/,
      );
      expect(issues(withMeters(linear({ resolutions: [{} as { size: '1x1' }] })))[0]).toMatch(
        /exactly one of size or aspect/,
      );
    });
  });
});

describe('assertValidManifest', () => {
  it('throws a ManifestError listing every issue', () => {
    try {
      assertValidManifest({
        title: '',
        properties: [{ property: 'name', type: 'color', label: 'C', default: 'x' }],
      });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestError);
      const { issues: list, message } = error as ManifestError;
      expect(list).toHaveLength(3);
      expect(message).toMatch(/^\[srgb-effect\] Invalid effect manifest:\n {2}- title/);
    }
  });

  it('does not throw for a valid manifest', () => {
    expect(() => assertValidManifest({ title: 'Ok' })).not.toThrow();
  });
});
