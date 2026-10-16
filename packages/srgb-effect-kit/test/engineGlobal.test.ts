import { runInThisContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { getFrequencies, isSilent } from '../src/runtime/audio';
import { getZone } from '../src/runtime/zones';

// SignalRGB's own examples read `engine` as a bare identifier. A global declared with `let` in a
// classic script is reachable that way but is not a property of `globalThis`. Such a binding can't
// be removed again, so it lives in this file alone.
describe('an engine global that is not a globalThis property', () => {
  it('is read by the runtime helpers', () => {
    runInThisContext(
      'let engine = { audio: { level: -20, freq: Array(200).fill(5) }, zone: { hue: [120], saturation: [50], lightness: [40] } };',
    );
    expect((globalThis as { engine?: unknown }).engine).toBeUndefined();

    expect(isSilent()).toBe(false);
    expect(getFrequencies()[0]).toBe(5);
    expect(getZone(0, 0)).toEqual({ h: 120, s: 50, l: 40 });
  });
});
