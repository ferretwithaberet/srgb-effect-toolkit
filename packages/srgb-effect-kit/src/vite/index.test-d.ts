import { srgbEffect } from './index';

srgbEffect({
  title: 'X',
  properties: [{ property: 'mode', type: 'list', label: 'Mode', values: ['A', 'B'], default: 'A' }],
});

srgbEffect({
  title: 'X',
  properties: [
    { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 1, default: 0 },
    // @ts-expect-error default must be one of values
    // prettier-ignore
    { property: 'mode', type: 'list', label: 'Mode', values: ['A', 'B'], default: 'C' },
  ],
});

srgbEffect({ title: 'X', devtools: 'minimal' });
srgbEffect({ title: 'X', devtools: { mode: 'none', fireChangedOnLoad: false } });
// @ts-expect-error the boolean form was replaced by modes
srgbEffect({ title: 'X', devtools: false });
