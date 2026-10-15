import { FREQUENCY_BINS } from '../runtime/audio';
import type { MockAudio } from './engine';

/** One `engine.audio` update. */
export interface AudioFrame {
  /** dB, -100..0 */
  level: number;
  /** 0..1 */
  width: number;
  /** 0..1 */
  density: number;
  /** At least 200 bands; extra bands are ignored. */
  freq: ArrayLike<number>;
}

/** Quietest level SignalRGB reports. */
export const MIN_LEVEL = -100;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Copies `frame` into `target` in place, keeping `target.freq`'s identity. Missing bands become 0. */
export function writeAudioFrame(target: MockAudio, frame: AudioFrame): void {
  target.level = frame.level;
  target.width = frame.width;
  target.density = frame.density;
  for (let i = 0; i < FREQUENCY_BINS; i += 1) target.freq[i] = frame.freq[i] ?? 0;
}

/** No audio: level -100, everything else 0. */
export const silentFrame = (): AudioFrame => ({
  level: MIN_LEVEL,
  width: 0,
  density: 0,
  freq: new Array<number>(FREQUENCY_BINS).fill(0),
});

/**
 * Plausible noise that `isSilent()` never treats as silence: level -60..0 dB, width and density
 * 0..1, and bands 0..255 that fall off towards high frequencies.
 */
export function randomFrame(random: () => number = Math.random): AudioFrame {
  return {
    level: -60 + random() * 60,
    width: random(),
    density: random(),
    freq: Array.from({ length: FREQUENCY_BINS }, (_, i) =>
      Math.round(random() * 255 * (1 - i / (2 * FREQUENCY_BINS))),
    ),
  };
}

/** Root mean square of `samples`; 0 when empty. */
export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i]! ** 2;
  return Math.sqrt(sum / samples.length);
}

/** Loudness in dB of samples in -1..1, clamped to -100..0. */
export function levelFromSamples(samples: ArrayLike<number>): number {
  const value = rms(samples);
  return value > 0 ? Math.min(0, Math.max(MIN_LEVEL, 20 * Math.log10(value))) : MIN_LEVEL;
}

/**
 * Stereo width 0..1 from the side (L−R) and mid (L+R) energy: 0 for mono, about 0.5 for
 * uncorrelated channels, 1 for channels in opposite phase. 0 for silence.
 */
export function stereoWidth(left: ArrayLike<number>, right: ArrayLike<number>): number {
  const length = Math.min(left.length, right.length);
  let mid = 0;
  let side = 0;
  for (let i = 0; i < length; i += 1) {
    mid += ((left[i]! + right[i]!) / 2) ** 2;
    side += ((left[i]! - right[i]!) / 2) ** 2;
  }
  const total = Math.sqrt(mid) + Math.sqrt(side);
  return total > 0 ? clamp01(Math.sqrt(side) / total) : 0;
}

/**
 * Spectral flatness 0..1 of the first `bins` bands: geometric over arithmetic mean, with bands
 * floored at 1/10000 of the loudest so empty bands don't collapse it. Near 0 for a pure tone, 1 for
 * a flat (white noise) spectrum, 0 when every band is 0.
 */
export function spectralFlatness(spectrum: ArrayLike<number>, bins = FREQUENCY_BINS): number {
  const length = Math.min(bins, spectrum.length);
  let max = 0;
  for (let i = 0; i < length; i += 1) max = Math.max(max, spectrum[i]!);
  if (max <= 0) return 0;
  const floor = max * 1e-4;
  let logSum = 0;
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    const value = Math.max(floor, spectrum[i]!);
    logSum += Math.log(value);
    sum += value;
  }
  return clamp01(Math.exp(logSum / length) / (sum / length));
}

/** Analyser readings for one frame of captured audio. */
export interface AnalyserReadings {
  /** Time-domain samples, -1..1. */
  left: ArrayLike<number>;
  right: ArrayLike<number>;
  /** Byte frequency data (0..255) of the mixed signal. */
  spectrum: ArrayLike<number>;
  /** The source has one channel: width is 0 and level comes from `left` alone. */
  mono: boolean;
}

/** Turns analyser readings into an `engine.audio` frame. */
export function analyserFrame({ left, right, spectrum, mono }: AnalyserReadings): AudioFrame {
  const length = Math.min(left.length, right.length);
  const mixed = mono ? left : Array.from({ length }, (_, i) => (left[i]! + right[i]!) / 2);
  return {
    level: levelFromSamples(mixed),
    width: mono ? 0 : stereoWidth(left, right),
    density: spectralFlatness(spectrum),
    freq: Array.from({ length: FREQUENCY_BINS }, (_, i) => spectrum[i] ?? 0),
  };
}
