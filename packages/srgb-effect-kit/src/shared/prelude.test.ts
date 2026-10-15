import { describe, expect, it } from 'vitest';
import { generatePrelude, handlerGlobalNames } from './prelude';

describe('generatePrelude', () => {
  it('defines missing handler globals so bare assignment works in strict code', () => {
    const prelude = generatePrelude({
      title: 'T',
      properties: [{ property: 'speed', type: 'number', label: 'S', min: 0, max: 1, default: 0 }],
    });
    const win: Record<string, unknown> = { onCanvasApiEvent: 'kept' };
    new Function('window', prelude)(win);
    expect(Object.keys(win).sort()).toEqual(['onCanvasApiEvent', 'onSpeedChanged']);
    expect(win.onSpeedChanged).toBeUndefined();
    expect(win.onCanvasApiEvent).toBe('kept');
  });

  it('is ES5 syntax only', () => {
    const prelude = generatePrelude({ title: 'T' });
    expect(prelude).not.toMatch(/=>|\blet\b|\bconst\b|`/);
  });
});

describe('handlerGlobalNames', () => {
  it('lists each property handler in order, then onCanvasApiEvent', () => {
    expect(
      handlerGlobalNames({
        title: 'T',
        properties: [
          { property: 'speed', type: 'number', label: 'S', min: 0, max: 1, default: 0 },
          { property: 'mode', type: 'list', label: 'M', values: ['A'], default: 'A' },
        ],
      }),
    ).toEqual(['onSpeedChanged', 'onModeChanged', 'onCanvasApiEvent']);
    expect(handlerGlobalNames({ title: 'T' })).toEqual(['onCanvasApiEvent']);
  });
});
