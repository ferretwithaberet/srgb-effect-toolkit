import { describe, expect, it, vi } from 'vitest';
import { createMeter } from './meter';

describe('createMeter', () => {
  it('fires only after `size` identical values that differ from the current value', () => {
    const callback = vi.fn();
    const meter = createMeter(3, callback);
    meter.setValue(1);
    meter.setValue(1);
    expect(callback).not.toHaveBeenCalled();
    meter.setValue(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(meter).toMatchObject({ value: 1, diff: 1, increased: true, decreased: false });
    meter.setValue(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('ignores unstable readings', () => {
    const callback = vi.fn();
    const meter = createMeter(2, callback);
    for (const v of [0.5, 0.6, 0.5, 0.6]) meter.setValue(v);
    expect(callback).not.toHaveBeenCalled();
  });

  it('reports decreases and passes itself to the callback', () => {
    const seen: number[] = [];
    const meter = createMeter(1, (m) => seen.push(m.value));
    meter.setValue(0.8);
    meter.setValue(0.3);
    expect(seen).toEqual([0.8, 0.3]);
    expect(meter).toMatchObject({ value: 0.3, increased: false, decreased: true });
    expect(meter.diff).toBeCloseTo(0.5);
  });

  it('rejects sizes below 1', () => {
    expect(() => createMeter(0, () => {})).toThrow(
      '[srgb-effect] createMeter: size must be a positive integer',
    );
  });
});
