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
      expect(issues(withProps(num('class')))[0]).toMatch(/identifier/);
      expect(issues(withProps(num('delete')))[0]).toMatch(/identifier/);
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
      expect(issues(withMeters(linear({ meter: 'default' })))[0]).toMatch(/identifier/);
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

describe('untyped (JavaScript) manifests', () => {
  const loose = (manifest: unknown) => () => collectManifestIssues(manifest as EffectManifest);

  it('reports a missing or non-string title instead of throwing', () => {
    expect(loose({})).not.toThrow();
    expect(loose({})()).toEqual(['title: must be a string']);
    expect(loose({ title: 42 })()).toEqual(['title: must be a string']);
    expect(loose(null)()).toEqual(['manifest: must be an object']);
  });

  it('reports non-string description and publisher', () => {
    expect(loose({ title: 'T', description: 1, publisher: {} })()).toEqual([
      'description: must be a string',
      'publisher: must be a string',
    ]);
  });

  it('reports non-array properties and meters', () => {
    expect(loose({ title: 'T', properties: {}, meters: 'm' })()).toEqual([
      'properties: must be an array',
      'meters: must be an array',
    ]);
  });

  it('reports malformed properties, naming the entry', () => {
    const run = loose({
      title: 'T',
      properties: [
        null,
        { property: 'a', type: 'number', min: 0, max: 1, default: 0 },
        { type: 'boolean', label: 'B', default: true },
        { property: 'c', type: 'slider', label: 'C', default: 1 },
        { property: 'd', type: 'list', label: 'D', default: 'x' },
        { property: 'e', type: 'list', label: 'E', values: ['x', 1], default: 'x' },
        { property: 'f', type: 'hue', label: 'F', min: '0', default: '10' },
        { property: 'g', type: 'boolean', label: 'G', default: 'yes' },
        { property: 'h', type: 'color', label: 'H', default: 255 },
        { property: 'i', type: 'textfield', label: 'I', default: 0, tooltip: 1 },
        { property: 'j', type: 'number', label: 'J', min: '0', max: 1, default: 0 },
      ],
    });
    expect(run).not.toThrow();
    expect(run()).toEqual([
      'properties[0]: must be an object',
      'properties[1] ("a"): label must be a string',
      'properties[2]: property must be a string',
      'properties[3] ("c"): unknown type "slider"',
      'properties[4] ("d"): values must be an array of strings',
      'properties[5] ("e"): values must be an array of strings',
      'properties[6] ("f"): default must be a number',
      'properties[6] ("f"): min and max must be numbers',
      'properties[7] ("g"): default must be a boolean',
      'properties[8] ("h"): default must be a #rrggbb hex color (got "255")',
      'properties[9] ("i"): default must be a string',
      'properties[9] ("i"): tooltip must be a string',
      'properties[10] ("j"): min, max and default must be whole numbers',
    ]);
  });

  it('reports malformed meters, naming the entry', () => {
    const run = loose({
      title: 'T',
      meters: [
        'm',
        { meter: 'a', type: 'ocr', x: 0, y: 0, width: 0.1, height: 0.1 },
        { meter: 'b', type: 'linear', x: 0, y: 0, width: 0.1, s: [0, 1], l: [0, 1, 2] },
        { meter: 'c', type: 'area', x: 0, y: '0', width: 0.1, h: [0, 1], s: [0, 1], l: [0, 1] },
        { meter: 'd', type: 'ocr_textmatch', x: 0, y: 0, width: 0.1, height: 0.1 },
        { type: 'ocr_numeric', x: 0, y: 0, width: 0.1, height: 0.1, confidence: '50' },
        { meter: 'e', type: 'ocr_numeric', x: 0, y: 0, width: 0.1, height: 0.1, tags: 'a' },
        { meter: 'f', type: 'ocr_numeric', x: 0, y: 0, width: 0.1, height: 0.1, resolutions: [1] },
        { ...linear({ meter: 'g' }), hdr: 'bright' },
      ],
    });
    expect(run).not.toThrow();
    expect(run()).toEqual([
      'meters[0]: must be an object',
      'meters[1] ("a"): unknown type "ocr"',
      'meters[2] ("b"): h must be a [min, max] pair of numbers',
      'meters[2] ("b"): l must be a [min, max] pair of numbers',
      'meters[3] ("c"): y must be a finite number (got "0")',
      'meters[3] ("c"): height must be a finite number (got undefined)',
      'meters[4] ("d"): string must be a string',
      'meters[5]: meter must be a string',
      'meters[5]: confidence must be a number between 0 and 100',
      'meters[6] ("e"): tags must be an array of strings',
      'meters[7] ("f") resolutions[0]: must be an object',
      'meters[8] ("g"): hdr must be an object with h, s and l ranges',
    ]);
  });

  it('reports the entry through assertValidManifest', () => {
    expect(() =>
      assertValidManifest({ title: 'T', properties: [{ property: 'x' }] } as never),
    ).toThrow(/properties\[0\] \("x"\): label must be a string/);
  });
});

describe('meter tags and linear resolutions', () => {
  it('rejects tags containing commas', () => {
    expect(issues(withMeters(linear({ tags: ['ok', 'a,b'] })))).toEqual([
      'meters[0] ("m"): tag "a,b" must not contain commas (SignalRGB separates tags with commas)',
    ]);
  });

  it('rejects height on a linear meter resolution', () => {
    expect(
      issues(withMeters(linear({ resolutions: [{ size: '1920x1080', height: 0.1 }] }))),
    ).toEqual(['meters[0] ("m") resolutions[0]: height is not allowed on linear meters']);
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
