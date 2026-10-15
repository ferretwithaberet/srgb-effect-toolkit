// Single source of the SignalRGB globals' types. `srgb-effect-kit/client` pulls the
// `declare global` block below into effect projects, so `engine`, `window.engine` and
// `onCanvasApiEvent` are typed without any wrapper.

/** Raw boolean property value. Provisional until the probe confirms the real shape. */
type RawBoolean = '0' | '1';
export type { RawBoolean as SRGBBoolean };

export interface EngineAudio {
  /** Loudness in dB, -100 (silent) to 0 (loud). */
  level: number;
  /** Stereo width, 0–1. */
  width: number;
  /** 0 (pure tone) to 1 (white noise). */
  density: number;
  /** 200 frequency bands. Values can be negative or garbage; prefer getFrequencies(). */
  freq: ArrayLike<number>;
}

/** 28×20 screen grid, 560 entries per channel. */
export interface EngineZone {
  hue: ArrayLike<number>;
  saturation: ArrayLike<number>;
  lightness: ArrayLike<number>;
}

/** The `engine` global SignalRGB injects. */
export interface SRGBEngine {
  audio: EngineAudio;
  zone: EngineZone;
  /** Screen meter values keyed by meter name. */
  vision: SRGBVision;
}

export interface CanvasApiEvent {
  sender: string;
  event: string;
}

declare global {
  /** Screen meter values. Augmented with one key per meter by the generated types file. */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented via declaration merging
  interface SRGBVision {}

  /** Raw boolean property value. */
  type SRGBBoolean = RawBoolean;

  /** Injected by SignalRGB. Undefined outside SignalRGB until devtools mock it. */
  var engine: SRGBEngine;
  var onCanvasApiEvent: ((event: CanvasApiEvent) => void) | undefined;
}
