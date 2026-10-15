import type { MeterDef } from '../shared';
import type { FrameScheduler } from './context';
import { initialMeterValue, type MockEngine } from './engine';
import {
  clampMeterValue,
  evaluateHslMeter,
  isHslMeter,
  resolveMeterRegion,
  toPixelRect,
} from './meters';
import { isRecord, type DevtoolsStorage } from './storage';
import { fillGradientZones, fillSolidZones, sampleZones } from './zones';

/** What `engine.zone` (and, while capturing, the linear/area meters) are computed from. */
export type ScreenSource =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string }
  | { kind: 'capture' };

export const DEFAULT_SCREEN_SOURCE: ScreenSource = { kind: 'solid', color: '#000000' };

/** One downscaled capture frame. */
export interface CaptureFrame {
  /** RGBA, row-major. */
  pixels: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
  /** The captured screen's real size, used to pick meter resolution overrides. */
  sourceWidth: number;
  sourceHeight: number;
}

/** A live screen capture. `read()` returns undefined until the first frame arrives. */
export interface FrameSource {
  read(): CaptureFrame | undefined;
  stop(): void;
}

/** Opens a screen capture; `openScreenCapture` in browsers, a fake in tests. */
export type OpenScreenCapture = (onEnded: () => void) => Promise<FrameSource>;

/** How often a capture is sampled. */
export const CAPTURE_INTERVAL_MS = 100;
/** Width captured frames are scaled down to before sampling. */
export const CAPTURE_SAMPLE_WIDTH = 480;

export interface ScreenController {
  readonly source: ScreenSource;
  /** Message of the last failed capture attempt. */
  readonly error: string | undefined;
  /** Latest frame while capturing. */
  readonly frame: CaptureFrame | undefined;
  /** Switches the source. A failed capture falls back to the previous source with `error` set. */
  setSource(source: ScreenSource): Promise<void>;
  /** Sets and persists a meter's manual value, clamped to its type's range. */
  setMeter(name: string, value: number): void;
  /** The meter's manual value (what `engine.vision` holds unless the meter is automatic). */
  manualValue(name: string): number | undefined;
  /** Whether the meter is currently computed from the capture (linear and area meters only). */
  isAutomatic(name: string): boolean;
  subscribe(listener: () => void): () => void;
}

const SOURCE_KEY = 'screen';
const METERS_KEY = 'meters';
const HEX = /^#[0-9a-f]{6}$/i;
const isHex = (value: unknown) => typeof value === 'string' && HEX.test(value);

/** Validates a persisted source; captures are never restored because they need a user gesture. */
export const isStoredSource = (value: unknown): value is ScreenSource => {
  if (!isRecord(value)) return false;
  if (value.kind === 'solid') return isHex(value.color);
  if (value.kind === 'gradient') return isHex(value.from) && isHex(value.to);
  return false;
};

/**
 * Owns `engine.zone` and `engine.vision`. Solid and gradient sources fill the zones once; a capture
 * is sampled every `CAPTURE_INTERVAL_MS` (driven by the native rAF) into the zones and every
 * linear/area meter. OCR meters, and every meter while not capturing, use their manual values.
 */
export function createScreenController(
  engine: MockEngine,
  meters: readonly MeterDef[],
  storage: DevtoolsStorage,
  raf: FrameScheduler,
  openCapture: OpenScreenCapture,
): ScreenController {
  let source: ScreenSource = storage.read(SOURCE_KEY, isStoredSource) ?? DEFAULT_SCREEN_SOURCE;
  let error: string | undefined;
  let frame: CaptureFrame | undefined;
  let capture: FrameSource | undefined;
  let frameId: number | undefined;
  let generation = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const stored = storage.read(METERS_KEY, isRecord) ?? {};
  const manual = new Map<string, number>();
  for (const meter of meters) {
    const value = stored[meter.meter];
    manual.set(
      meter.meter,
      typeof value === 'number' ? clampMeterValue(meter, value) : initialMeterValue(meter),
    );
  }
  const writeManual = () => {
    for (const meter of meters) engine.vision[meter.meter] = manual.get(meter.meter)!;
  };

  const fill = (next: ScreenSource) => {
    if (next.kind === 'solid') fillSolidZones(engine.zone, next.color);
    else if (next.kind === 'gradient') fillGradientZones(engine.zone, next.from, next.to);
  };

  /** Reads and samples one frame. Throws if the source or the sampling fails. */
  const sample = (): boolean => {
    const next = capture?.read();
    if (!next) return false;
    frame = next;
    sampleZones(engine.zone, next.pixels, next.width, next.height);
    for (const meter of meters) {
      if (!isHslMeter(meter)) continue;
      const region = resolveMeterRegion(meter, next.sourceWidth, next.sourceHeight);
      const rect = toPixelRect(region, meter.type === 'linear', next.width, next.height);
      engine.vision[meter.meter] = evaluateHslMeter(meter, next.pixels, next.width, rect);
    }
    return true;
  };

  const stopCapture = () => {
    if (frameId !== undefined) raf.cancel(frameId);
    frameId = undefined;
    const stopping = capture;
    capture = undefined;
    frame = undefined;
    stopping?.stop();
  };

  const messageOf = (reason: unknown) =>
    reason instanceof Error ? reason.message : String(reason);

  /** Drops the capture and returns to `fallback` with `error` set. */
  const fail = (reason: unknown, fallback: ScreenSource) => {
    generation += 1;
    stopCapture();
    error = messageOf(reason);
    source = fallback;
    fill(fallback);
    writeManual();
    notify();
  };

  /** One sampling pass; returns false (after falling back to the default source) if it threw. */
  const step = (): boolean => {
    try {
      if (sample()) notify();
      return true;
    } catch (reason) {
      fail(reason, DEFAULT_SCREEN_SOURCE);
      return false;
    }
  };

  const run = (opened: FrameSource) => {
    capture = opened;
    let last: number | undefined;
    const tick = (time: number) => {
      frameId = undefined;
      if (capture !== opened) return;
      if (last === undefined) {
        // The first frame was sampled by `run`; the interval counts from this tick.
        last = time;
      } else if (time - last >= CAPTURE_INTERVAL_MS) {
        // Advance by whole intervals so a 60 Hz display averages one sample per 100 ms.
        last += CAPTURE_INTERVAL_MS;
        if (time - last >= CAPTURE_INTERVAL_MS) last = time;
        if (!step()) return;
      }
      if (capture === opened) frameId = raf.request(tick);
    };
    if (!step()) return;
    if (capture === opened) frameId = raf.request(tick);
  };

  /** `notice` is a plain status message shown instead of an error, e.g. when a share ended. */
  const setSource = async (next: ScreenSource, notice?: string) => {
    const current = (generation += 1);
    const previous = source.kind === 'capture' ? DEFAULT_SCREEN_SOURCE : source;
    stopCapture();
    error = notice;
    source = next;
    if (next.kind !== 'capture') {
      storage.write(SOURCE_KEY, next);
      fill(next);
      writeManual();
      notify();
      return;
    }
    // No stale computed values may linger while a permission prompt is open.
    writeManual();
    notify();
    try {
      const opened = await openCapture(() => {
        if (current === generation) void setSource(previous, 'Screen capture ended.');
      });
      if (current !== generation) {
        opened.stop();
        return;
      }
      run(opened);
    } catch (reason) {
      if (current !== generation) return;
      fail(reason, previous);
    }
  };

  const isAutomatic = (name: string) => {
    const meter = meters.find((m) => m.meter === name);
    return capture !== undefined && meter !== undefined && isHslMeter(meter);
  };

  fill(source);
  writeManual();

  return {
    get source() {
      return source;
    },
    get error() {
      return error;
    },
    get frame() {
      return frame;
    },
    setSource,
    setMeter(name, value) {
      const meter = meters.find((m) => m.meter === name);
      if (!meter) return;
      manual.set(name, clampMeterValue(meter, value));
      storage.write(METERS_KEY, Object.fromEntries(manual));
      if (!isAutomatic(name)) engine.vision[name] = manual.get(name)!;
      notify();
    },
    manualValue: (name) => manual.get(name),
    isAutomatic,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Captures a screen, window or tab with `getDisplayMedia` and returns frames scaled to
 * `CAPTURE_SAMPLE_WIDTH` pixels wide. `onEnded` runs when the user stops sharing.
 */
export async function openScreenCapture(
  onEnded: () => void,
  media: MediaDevices | undefined = navigator.mediaDevices,
): Promise<FrameSource> {
  if (typeof media?.getDisplayMedia !== 'function') {
    throw new Error('[srgb-effect] screen capture needs a secure context (https or localhost)');
  }
  const stream = await media.getDisplayMedia({ video: true, audio: false });
  const tracks = stream.getTracks();
  let video: HTMLVideoElement | undefined;
  let endedOnce = false;
  const ended = () => {
    if (endedOnce) return;
    endedOnce = true;
    onEnded();
  };
  const release = () => {
    for (const track of tracks) track.removeEventListener('ended', ended);
    for (const track of tracks) track.stop();
    if (video) video.srcObject = null;
  };

  try {
    if (stream.getVideoTracks().length === 0) throw new Error('[srgb-effect] No video was shared.');
    for (const track of tracks) track.addEventListener('ended', ended);
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context)
      throw new Error('[srgb-effect] A 2D canvas is not available to read the capture.');
    const shown = video;

    return {
      read() {
        const { videoWidth, videoHeight } = shown;
        if (videoWidth === 0 || videoHeight === 0) return undefined;
        const width = Math.min(CAPTURE_SAMPLE_WIDTH, videoWidth);
        const height = Math.max(1, Math.round((videoHeight * width) / videoWidth));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        context.drawImage(shown, 0, 0, width, height);
        const { data } = context.getImageData(0, 0, width, height);
        return { pixels: data, width, height, sourceWidth: videoWidth, sourceHeight: videoHeight };
      },
      stop: release,
    };
  } catch (reason) {
    release();
    throw reason;
  }
}
