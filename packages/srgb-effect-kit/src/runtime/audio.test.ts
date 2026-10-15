import { afterEach, describe, expect, it } from 'vitest';
import { FREQUENCY_BINS, getFrequencies, isSilent } from './audio';

const freq = (fill: number) => Array.from({ length: FREQUENCY_BINS }, () => fill);
afterEach(() => {
  delete (globalThis as { engine?: unknown }).engine;
});

describe('isSilent', () => {
  it('is silent without an engine', () => {
    expect(isSilent()).toBe(true);
  });

  it('is silent at -100 dB or when the spectrum sum is below the threshold', () => {
    expect(isSilent({ level: -100, freq: freq(200) })).toBe(true);
    expect(isSilent({ level: -40, freq: [1, 1, 2, 4, 6, 19] })).toBe(true);
    expect(isSilent({ level: -40, freq: [] })).toBe(true);
  });

  it('ignores negative garbage values in the sum', () => {
    expect(isSilent({ level: -40, freq: [-2147483648, 10, 10] })).toBe(true);
  });

  it('is not silent with real signal', () => {
    expect(isSilent({ level: -20, freq: freq(1) })).toBe(false);
  });

  it('reads the engine global by default', () => {
    (globalThis as { engine?: unknown }).engine = { audio: { level: -20, freq: freq(5) } };
    expect(isSilent()).toBe(false);
  });
});

describe('getFrequencies', () => {
  it('returns 200 zeros without an engine', () => {
    expect(getFrequencies()).toEqual(freq(0));
  });

  it('sanitizes negatives, non-finite values and overflow, and pads to 200', () => {
    const result = getFrequencies({ freq: [10, -5, Number.NaN, 300, Infinity, 255.4] });
    expect(result.slice(0, 6)).toEqual([10, 0, 0, 255, 0, 255]);
    expect(result).toHaveLength(FREQUENCY_BINS);
  });
});
