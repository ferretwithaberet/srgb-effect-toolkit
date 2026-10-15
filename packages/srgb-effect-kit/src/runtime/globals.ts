// Single source of the SignalRGB globals' types. `srgb-effect-kit/client` pulls the
// `declare global` block below into effect projects, so `engine`, `window.engine` and
// `onCanvasApiEvent` are typed without any wrapper.

/**
 * Raw value of a `boolean` property global: `'0'` or `'1'`. Provisional until the probe confirms
 * the real shape on SignalRGB; read it with `parseBoolean()`, which accepts every plausible form.
 */
type RawBoolean = '0' | '1';
export type { RawBoolean as SRGBBoolean };

/** `engine.audio`: the system audio SignalRGB analyzes, updated continuously. */
export interface EngineAudio {
  /** Loudness in dB, -100 (silent) to 0 (loud). */
  level: number;
  /** Stereo width, 0–1. */
  width: number;
  /** 0 (pure tone) to 1 (white noise). */
  density: number;
  /** 200 frequency bands. Values can be negative or garbage; prefer `getFrequencies()`. */
  freq: ArrayLike<number>;
}

/**
 * `engine.zone`: screen colors sampled on a 28×20 grid. Each channel has 560 entries in row-major
 * order (index `y * 28 + x`, origin top-left). Read cells with `getZone()` or `getZones()`.
 */
export interface EngineZone {
  /** Hue per cell. */
  hue: ArrayLike<number>;
  /** Saturation per cell. */
  saturation: ArrayLike<number>;
  /** Lightness per cell. */
  lightness: ArrayLike<number>;
}

/** The `engine` global SignalRGB injects. Undefined outside SignalRGB. */
export interface SRGBEngine {
  /** System audio analysis. */
  audio: EngineAudio;
  /** Screen colors on a 28×20 grid. */
  zone: EngineZone;
  /** Screen meter values keyed by meter name, e.g. `engine.vision.health`. */
  vision: SRGBVision;
}

/**
 * Argument of `onCanvasApiEvent`, sent by an app through
 * `POST http://localhost:16034/canvas/event?sender=…&event=…`.
 */
export interface CanvasApiEvent {
  /** The `sender` query parameter. */
  sender: string;
  /** The `event` query parameter. */
  event: string;
}

declare global {
  /** Screen meter values. Augmented with one key per meter by the generated types file. */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented via declaration merging
  interface SRGBVision {}

  /** Raw value of a `boolean` property global (`'0' | '1'`, provisional). See `parseBoolean()`. */
  type SRGBBoolean = RawBoolean;

  /**
   * Injected by SignalRGB: audio, screen zones and meter values. Undefined outside SignalRGB until
   * devtools mock it, so guard it (`globalThis.engine?.audio`) in code that also runs in a browser.
   */
  var engine: SRGBEngine;
  /**
   * Assign a function here to receive canvas API events (`window.onCanvasApiEvent = (e) => …`).
   * SignalRGB calls it for each `POST http://localhost:16034/canvas/event?sender=…&event=…`.
   */
  var onCanvasApiEvent: ((event: CanvasApiEvent) => void) | undefined;
}
