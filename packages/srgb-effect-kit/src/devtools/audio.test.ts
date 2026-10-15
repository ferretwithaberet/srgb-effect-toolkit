import { describe, expect, it } from 'vitest';
import { isSilent } from '../runtime/audio';
import {
  analyserFrame,
  levelFromSamples,
  randomFrame,
  rms,
  silentFrame,
  spectralFlatness,
  stereoWidth,
  writeAudioFrame,
} from './audio';
import { createEngineMock } from './engine';

/** Deterministic generator for reproducible frames. */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const sine = (length: number, amplitude: number, phase = 0) =>
  Array.from({ length }, (_, i) => amplitude * Math.sin((i / 16) * Math.PI + phase));

describe('audio frames', () => {
  it('writes frames in place, keeping the freq array', () => {
    const { audio } = createEngineMock();
    const freq = audio.freq;
    writeAudioFrame(audio, { level: -20, width: 0.5, density: 0.25, freq: [1, 2, 3] });
    expect(audio.freq).toBe(freq);
    expect(audio).toMatchObject({ level: -20, width: 0.5, density: 0.25 });
    expect(audio.freq.slice(0, 4)).toEqual([1, 2, 3, 0]);
    expect(audio.freq).toHaveLength(200);
  });

  it('silent frames read as silence', () => {
    expect(isSilent(silentFrame())).toBe(true);
    expect(silentFrame()).toMatchObject({ level: -100, width: 0, density: 0 });
  });

  it('random frames stay in range and never read as silence', () => {
    const random = seeded(42);
    for (let i = 0; i < 50; i += 1) {
      const frame = randomFrame(random);
      expect(frame.level).toBeGreaterThanOrEqual(-60);
      expect(frame.level).toBeLessThanOrEqual(0);
      expect(frame.width).toBeGreaterThanOrEqual(0);
      expect(frame.width).toBeLessThanOrEqual(1);
      expect(frame.density).toBeGreaterThanOrEqual(0);
      expect(frame.density).toBeLessThanOrEqual(1);
      expect(frame.freq).toHaveLength(200);
      for (const band of Array.from(frame.freq)) {
        expect(band).toBeGreaterThanOrEqual(0);
        expect(band).toBeLessThanOrEqual(255);
      }
      expect(isSilent(frame)).toBe(false);
    }
  });
});

describe('audio analysis', () => {
  it('computes RMS and dB levels clamped to -100..0', () => {
    expect(rms([])).toBe(0);
    expect(rms([1, -1])).toBe(1);
    expect(levelFromSamples([1, -1])).toBe(0);
    expect(levelFromSamples(new Array(8).fill(0.1))).toBeCloseTo(-20, 5);
    expect(levelFromSamples(new Array(8).fill(0))).toBe(-100);
    expect(levelFromSamples(new Array(8).fill(1e-9))).toBe(-100);
    expect(levelFromSamples(new Array(8).fill(4))).toBe(0);
  });

  it('measures stereo width from mid and side energy', () => {
    const left = sine(256, 0.5);
    expect(stereoWidth(left, left)).toBe(0);
    expect(
      stereoWidth(
        left,
        left.map((v) => -v),
      ),
    ).toBe(1);
    const random = seeded(7);
    const noiseL = Array.from({ length: 4096 }, () => random() * 2 - 1);
    const noiseR = Array.from({ length: 4096 }, () => random() * 2 - 1);
    expect(stereoWidth(noiseL, noiseR)).toBeGreaterThan(0.4);
    expect(stereoWidth(noiseL, noiseR)).toBeLessThan(0.6);
    expect(stereoWidth([0, 0], [0, 0])).toBe(0);
  });

  it('measures density as spectral flatness', () => {
    expect(spectralFlatness(new Array(200).fill(120))).toBeCloseTo(1, 5);
    const tone = new Array(200).fill(0);
    tone[20] = 255;
    expect(spectralFlatness(tone)).toBeLessThan(0.1);
    expect(spectralFlatness(new Array(200).fill(0))).toBe(0);
    expect(spectralFlatness([])).toBe(0);
  });

  it('builds frames from analyser readings', () => {
    const left = sine(512, 0.5);
    const spectrum = Array.from({ length: 256 }, (_, i) => (i < 200 ? 100 : 255));
    const stereo = analyserFrame({ left, right: left, spectrum, mono: false });
    expect(stereo.level).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 1);
    expect(stereo.width).toBe(0);
    expect(stereo.density).toBeCloseTo(1, 5);
    expect(Array.from(stereo.freq)).toEqual(new Array(200).fill(100));

    const mono = analyserFrame({ left, right: new Array(512).fill(0), spectrum, mono: true });
    expect(mono.width).toBe(0);
    expect(mono.level).toBeCloseTo(stereo.level, 5);
  });
});
