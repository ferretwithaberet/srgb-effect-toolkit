import { ctorName, serialize } from '../log';
import { keysOf } from '../describe';
import { now } from '../state';
import { getEngine } from './engine';

const KNOWN = ['level', 'width', 'density', 'freq'];

interface Range {
  min: number | null;
  max: number | null;
  nonNumber: number;
}

const range = (): Range => ({ min: null, max: null, nonNumber: 0 });

const track = (r: Range, value: unknown): void => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    r.nonNumber++;
    return;
  }
  r.min = r.min === null ? value : Math.min(r.min, value);
  r.max = r.max === null ? value : Math.max(r.max, value);
};

/** Samples `engine.audio` once per animation frame; `result()` summarises the ranges. */
export function createAudioRecorder() {
  let frames = 0;
  let framesWithAudio = 0;
  const level = range();
  const width = range();
  const density = range();
  const freq = {
    lengths: [] as number[],
    ctors: [] as (string | null)[],
    min: null as number | null,
    max: null as number | null,
    negative: 0,
    nonFinite: 0,
    newObjectFrames: 0,
    sameObjectFrames: 0,
    firstSample: null as unknown,
    /** The frame whose finite bands summed highest: its first 16 bands, sum and peak band. */
    loudestSample: null as unknown,
  };
  let loudestSum = -Infinity;
  // Data refresh rate: frames where level or the freq contents differ from the previous frame.
  const start = now();
  let compared = 0;
  let updates = 0;
  let previousLevel: unknown = undefined;
  let previousBands: unknown[] | null = null;
  let previousFreq: unknown = undefined;
  let otherKeys: string[] | null = null;

  return {
    sample(): void {
      frames++;
      const engine = getEngine();
      const audio = engine ? (engine.audio as Record<string, unknown> | undefined) : undefined;
      if (!audio || typeof audio !== 'object') return;
      framesWithAudio++;
      if (otherKeys === null) otherKeys = keysOf(audio).filter((key) => KNOWN.indexOf(key) === -1);
      track(level, audio.level);
      track(width, audio.width);
      track(density, audio.density);
      const bands = audio.freq as ArrayLike<unknown> | undefined;
      if (!bands || typeof bands.length !== 'number') return;
      if (freq.lengths.indexOf(bands.length) === -1) freq.lengths.push(bands.length);
      const ctor = ctorName(bands);
      if (freq.ctors.indexOf(ctor) === -1) freq.ctors.push(ctor);
      if (previousFreq !== undefined) {
        if (bands === previousFreq) freq.sameObjectFrames++;
        else freq.newObjectFrames++;
      }
      previousFreq = bands;
      if (freq.firstSample === null) {
        freq.firstSample = serialize(Array.prototype.slice.call(bands, 0, 16));
      }
      const copy: unknown[] = Array.prototype.slice.call(bands);
      let sum = 0;
      let peak = -1;
      for (let i = 0; i < copy.length; i++) {
        const value = copy[i];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          freq.nonFinite++;
          continue;
        }
        if (value < 0) freq.negative++;
        freq.min = freq.min === null ? value : Math.min(freq.min, value);
        freq.max = freq.max === null ? value : Math.max(freq.max, value);
        sum += value;
        if (peak === -1 || value > (copy[peak] as number)) peak = i;
      }
      if (sum > loudestSum) {
        loudestSum = sum;
        freq.loudestSample = serialize({
          frame: frames,
          sum,
          peakBand: peak,
          peakValue: peak === -1 ? null : copy[peak],
          bands: copy.slice(0, 16),
        });
      }
      if (previousBands !== null) {
        compared++;
        let differs =
          !Object.is(audio.level, previousLevel) || copy.length !== previousBands.length;
        for (let i = 0; !differs && i < copy.length; i++) {
          if (!Object.is(copy[i], previousBands[i])) differs = true;
        }
        if (differs) updates++;
      }
      previousLevel = audio.level;
      previousBands = copy;
    },
    /** How often the engine's audio data actually changed, against how often it was read. */
    updates() {
      const seconds = (now() - start) / 1000;
      return {
        count: updates,
        comparedFrames: compared,
        hz: seconds > 0 ? updates / seconds : null,
      };
    },
    result() {
      const engine = getEngine();
      return {
        engineTypeof: typeof engine,
        frames,
        framesWithAudio,
        level,
        width,
        density,
        freq,
        otherKeys,
      };
    },
  };
}
