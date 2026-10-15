import { serialize } from '../log';
import { meterNames } from '../names';
import { getEngine } from './engine';

interface MeterTrack {
  samples: number;
  min: number | null;
  max: number | null;
  types: string[];
  last: unknown;
}

/** Samples every `engine.vision` meter once per animation frame. */
export function createMeterRecorder() {
  const tracks: Record<string, MeterTrack> = {};
  for (const name of meterNames)
    tracks[name] = { samples: 0, min: null, max: null, types: [], last: null };
  let frames = 0;
  let framesWithVision = 0;

  return {
    sample(): void {
      frames++;
      const engine = getEngine();
      const vision = engine ? (engine.vision as Record<string, unknown> | undefined) : undefined;
      if (!vision || typeof vision !== 'object') return;
      framesWithVision++;
      for (const name of meterNames) {
        const track = tracks[name]!;
        const value = vision[name];
        track.samples++;
        track.last = value;
        if (track.types.indexOf(typeof value) === -1) track.types.push(typeof value);
        if (typeof value === 'number' && !Number.isNaN(value)) {
          track.min = track.min === null ? value : Math.min(track.min, value);
          track.max = track.max === null ? value : Math.max(track.max, value);
        }
      }
    },
    result() {
      const meters: Record<string, unknown> = {};
      for (const name of meterNames) {
        const track = tracks[name]!;
        meters[name] = { ...track, last: serialize(track.last) };
      }
      return { frames, framesWithVision, meters };
    },
  };
}
