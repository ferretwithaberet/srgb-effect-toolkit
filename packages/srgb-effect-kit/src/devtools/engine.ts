import { FREQUENCY_BINS } from '../runtime/audio';
import type { SRGBEngine } from '../runtime/globals';
import { ZONE_COLUMNS, ZONE_ROWS } from '../runtime/zones';
import type { MeterDef } from '../shared';

/** `engine.audio` with a mutable `freq` array. */
export interface MockAudio {
  level: number;
  width: number;
  density: number;
  freq: number[];
}

/** `engine.zone` with mutable 560-entry arrays. */
export interface MockZone {
  hue: number[];
  saturation: number[];
  lightness: number[];
}

/** The dev-mode `engine` global. The devtools mutate it in place, so cached references stay live. */
export interface MockEngine extends SRGBEngine {
  audio: MockAudio;
  zone: MockZone;
  vision: SRGBVision & Record<string, number>;
}

/** A meter's value before anything is measured: -1 (no reading) for `ocr_numeric`, else 0. */
export const initialMeterValue = (meter: MeterDef): number =>
  meter.type === 'ocr_numeric' ? -1 : 0;

/** Silent audio, a black screen and every meter at its initial value. */
export function createEngineMock(meters: readonly MeterDef[] = []): MockEngine {
  const cells = ZONE_COLUMNS * ZONE_ROWS;
  return {
    audio: {
      level: -100,
      width: 0,
      density: 0,
      freq: new Array<number>(FREQUENCY_BINS).fill(0),
    },
    zone: {
      hue: new Array<number>(cells).fill(0),
      saturation: new Array<number>(cells).fill(0),
      lightness: new Array<number>(cells).fill(0),
    },
    vision: Object.fromEntries(
      meters.map((meter) => [meter.meter, initialMeterValue(meter)]),
    ) as SRGBVision & Record<string, number>,
  };
}
