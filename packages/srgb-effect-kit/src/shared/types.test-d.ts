import type { EffectManifest, MeterDef, PropertyDef } from './types';

export const ok: EffectManifest = {
  title: 'Hue Cycle',
  description: 'Rainbow wave',
  publisher: 'ferret',
  properties: [
    { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
    { property: 'hue', type: 'hue', label: 'Hue', default: 120 },
    { property: 'on', type: 'boolean', label: 'On', default: true },
    { property: 'tint', type: 'color', label: 'Tint', default: '#009bde' },
    { property: 'text', type: 'textfield', label: 'Text', default: '' },
    { property: 'mode', type: 'list', label: 'Mode', values: ['A', 'B'], default: 'A' },
  ],
  meters: [
    { meter: 'a', type: 'linear', x: 0, y: 0, width: 0.1, h: [0, 360], s: [0, 100], l: [0, 100] },
    {
      meter: 'b',
      type: 'area',
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
      h: [0, 1],
      s: [0, 1],
      l: [0, 1],
    },
    { meter: 'c', type: 'ocr_textmatch', x: 0, y: 0, width: 0.1, height: 0.1, string: 'GO' },
    {
      meter: 'd',
      type: 'ocr_numeric',
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
      confidence: 80,
      resolutions: [{ size: '1920x1080', x: 0.2 }, { aspect: '21:9' }],
    },
  ],
};

// prettier-ignore
// @ts-expect-error number properties require min and max
export const missingMin: PropertyDef = { property: 'a', type: 'number', label: 'A', default: 1 };

// prettier-ignore
// @ts-expect-error linear meters have no height
export const linearHeight: MeterDef = { meter: 'a', type: 'linear', x: 0, y: 0, width: 0.1, height: 0.1, h: [0, 1], s: [0, 1], l: [0, 1] };

// prettier-ignore
// @ts-expect-error a resolution cannot have both size and aspect
export const both: MeterDef = { meter: 'a', type: 'ocr_numeric', x: 0, y: 0, width: 0.1, height: 0.1, resolutions: [{ size: '1x1', aspect: '1:1' }] };
