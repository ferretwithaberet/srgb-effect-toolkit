// Ambient SignalRGB globals. Referenced by the generated src/srgb-effect.d.ts in effect projects.
import type {
  CanvasApiEvent,
  Engine,
  SRGBBoolean as RuntimeSRGBBoolean,
} from './dist/runtime/index.js';

declare global {
  type SRGBBoolean = RuntimeSRGBBoolean;

  /** Screen meter values. Augmented with one key per meter by the generated types file. */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented via declaration merging
  interface SRGBVision {}

  var engine: Omit<Engine, 'vision'> & { vision: SRGBVision };
  var onCanvasApiEvent: ((event: CanvasApiEvent) => void) | undefined;
}

export {};
