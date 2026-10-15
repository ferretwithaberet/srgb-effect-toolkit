import { getEngine } from './engine';
import type { EngineAudio } from './types';

export const FREQUENCY_BINS = 200;
/**
 * SignalRGB leaks a low noise floor into `freq` while nothing is playing, so a spectrum whose
 * positive values sum to less than this counts as silence.
 */
export const SILENCE_SUM_THRESHOLD = 50;

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

/** 200 sanitized bands: non-finite or negative values become 0 and the rest clamp to 255. Range is provisional until probed. */
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
