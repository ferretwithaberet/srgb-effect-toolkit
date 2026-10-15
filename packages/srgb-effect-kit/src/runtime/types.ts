/** Raw boolean property value. Provisional until the probe confirms the real shape. */
export type SRGBBoolean = '0' | '1';

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

export interface Engine {
  audio: EngineAudio;
  zone: EngineZone;
  /** Screen meter values keyed by meter name. */
  vision: Record<string, number>;
}

export interface CanvasApiEvent {
  sender: string;
  event: string;
}
