import type { EngineAudio } from './globals';
import { getEngine } from './engine';

/** Number of frequency bands in `engine.audio.freq` and in `getFrequencies()`'s result. */
export const FREQUENCY_BINS = 200;
/**
 * SignalRGB leaks a low noise floor into `freq` while nothing is playing, so a spectrum whose
 * positive values sum to less than this counts as silence.
 */
export const SILENCE_SUM_THRESHOLD = 50;

/**
 * Whether no audio is playing. True when there is no audio data, when `level` is -100 dB or lower,
 * when `freq` is missing or empty, or when the positive `freq` values sum to less than
 * {@link SILENCE_SUM_THRESHOLD}. Negative values are ignored.
 *
 * @param audio - Defaults to `engine.audio`, or `undefined` outside SignalRGB (silent).
 */
export function isSilent(audio: Partial<EngineAudio> | undefined = getEngine()?.audio): boolean {
  if (!audio) return true;
  if (audio.level !== undefined && audio.level <= -100) return true;
  const { freq } = audio;
  if (!freq || freq.length === 0) return true;

  let sum = 0;
  for (let i = 0; i < freq.length; i += 1) {
    const value = freq[i]!;
    if (value > 0) sum += value;
    if (sum >= SILENCE_SUM_THRESHOLD) return false;
  }
  return true;
}

/**
 * Returns a new array of 200 sanitized bands: non-finite or negative values become 0 and the rest
 * clamp to 255. Missing bands are 0. The 0–255 range is provisional until probed on SignalRGB.
 *
 * @param audio - Defaults to `engine.audio`. Without audio data, returns 200 zeros.
 */
export function getFrequencies(
  audio: Partial<EngineAudio> | undefined = getEngine()?.audio,
): number[] {
  const freq = audio?.freq;
  const out = new Array<number>(FREQUENCY_BINS).fill(0);
  if (!freq) return out;
  for (let i = 0; i < Math.min(FREQUENCY_BINS, freq.length); i += 1) {
    const value = freq[i]!;
    out[i] = Number.isFinite(value) && value > 0 ? Math.min(255, value) : 0;
  }
  return out;
}
