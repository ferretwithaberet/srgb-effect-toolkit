import { ctorName, serialize } from '../log';
import { keysOf } from '../describe';
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
  };
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
      if (freq.firstSample === null)
        freq.firstSample = serialize(Array.prototype.slice.call(bands, 0, 16));
      for (let i = 0; i < bands.length; i++) {
        const value = bands[i];
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          freq.nonFinite++;
          continue;
        }
        if (value < 0) freq.negative++;
        freq.min = freq.min === null ? value : Math.min(freq.min, value);
        freq.max = freq.max === null ? value : Math.max(freq.max, value);
      }
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
