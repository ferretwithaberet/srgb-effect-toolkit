import type { Renderer } from '../runtime/renderer';
import type { DevtoolsWindow, FrameScheduler } from './context';
import { reportError } from './lifecycle';
import type { DevtoolsStorage } from './storage';

/** SignalRGB's FPS setting range. */
export const FPS_MIN = 20;
export const FPS_MAX = 60;

/**
 * User agents the simulation reports. Placeholders until the probe records the real strings; each
 * must match its renderer in `RENDERER_SIGNATURES`, so `detectRenderer()` needs no dev hook.
 */
export const SIMULATED_USER_AGENTS: Readonly<Record<Exclude<Renderer, 'browser'>, string>> = {
  ultralight:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/615.1.18.100.1 (KHTML, like Gecko) Ultralight/1.4.0 Version/16.4.1 Safari/615.1.18.100.1',
  qtwebengine:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/6.8.2 Chrome/122.0.6261.171 Safari/537.36',
};

/** Persisted Renderer tab state. */
export interface RendererSettings {
  renderer: Renderer;
  /** SignalRGB's FPS setting, 20–60. */
  fps: number;
}

export const DEFAULT_RENDERER_SETTINGS: RendererSettings = { renderer: 'browser', fps: 60 };

const RENDERERS: readonly Renderer[] = ['browser', 'ultralight', 'qtwebengine'];
const STORAGE_KEY = 'renderer';

export const clampFps = (fps: number): number =>
  Number.isFinite(fps) ? Math.min(FPS_MAX, Math.max(FPS_MIN, Math.round(fps))) : FPS_MAX;

export const isRendererSettings = (value: unknown): value is RendererSettings => {
  if (typeof value !== 'object' || value === null) return false;
  const { renderer, fps } = value as Record<string, unknown>;
  return RENDERERS.includes(renderer as Renderer) && typeof fps === 'number';
};

/** Makes `navigator.userAgent` report `userAgent` for the rest of the page's life. */
export function overrideUserAgent(navigator: Navigator, userAgent: string): void {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => userAgent });
}

/** rAF timestamps may arrive this many ms early and still count, to absorb jitter. */
const JITTER_TOLERANCE_MS = 1;

/**
 * A `requestAnimationFrame` that runs callbacks at most `getFps()` times per second, like
 * UltraLight does at SignalRGB's FPS setting. Callbacks requested during a flush run in a later
 * one. A throwing callback is reported through `report` and doesn't stop the others, like native
 * rAF. Built on `native`, which must be the unpatched rAF.
 */
export function createRafThrottle(
  native: FrameScheduler,
  getFps: () => number,
  report: (error: unknown) => void = (error) => reportError(globalThis as DevtoolsWindow, error),
): FrameScheduler {
  let nextId = 1;
  let pending = new Map<number, FrameRequestCallback>();
  let scheduled = false;
  let anchor: number | undefined;

  const pump = (timestamp: number) => {
    scheduled = false;
    if (pending.size === 0) return;
    const interval = 1000 / getFps();
    if (anchor !== undefined) {
      const elapsed = timestamp - anchor;
      if (elapsed < interval - JITTER_TOLERANCE_MS) {
        schedule();
        return;
      }
      // Advance by whole intervals so the cadence doesn't drift.
      const remainder = elapsed % interval;
      anchor = remainder > interval - JITTER_TOLERANCE_MS ? timestamp : timestamp - remainder;
    } else {
      anchor = timestamp;
    }
    const callbacks = pending;
    pending = new Map();
    for (const callback of callbacks.values()) {
      try {
        callback(timestamp);
      } catch (error) {
        report(error);
      }
    }
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    native.request(pump);
  };

  return {
    request(callback) {
      const id = nextId;
      nextId += 1;
      pending.set(id, callback);
      schedule();
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
  };
}

/** The Renderer tab's state and actions. */
export interface RendererController {
  readonly settings: Readonly<RendererSettings>;
  /** Persists the renderer, then reloads the page so effect code starts under it. */
  setRenderer(renderer: Renderer): void;
  /** Persists and applies the FPS setting immediately. */
  setFps(fps: number): void;
  subscribe(listener: (settings: Readonly<RendererSettings>) => void): () => void;
}

/**
 * Applies the persisted simulation before effect code runs: the renderer's user agent and, for
 * UltraLight, a rAF throttled to the FPS setting. QtWebEngine keeps the native rAF rate.
 */
export function installRendererSimulation(
  win: DevtoolsWindow,
  storage: DevtoolsStorage,
  native: FrameScheduler,
  reload: () => void = () => win.location.reload(),
): RendererController {
  const stored = storage.read(STORAGE_KEY, isRendererSettings);
  let settings: RendererSettings = stored
    ? { renderer: stored.renderer, fps: clampFps(stored.fps) }
    : { ...DEFAULT_RENDERER_SETTINGS };
  const listeners = new Set<(settings: Readonly<RendererSettings>) => void>();

  if (settings.renderer !== 'browser') {
    overrideUserAgent(win.navigator, SIMULATED_USER_AGENTS[settings.renderer]);
  }
  if (settings.renderer === 'ultralight') {
    const throttle = createRafThrottle(
      native,
      () => settings.fps,
      (error) => reportError(win, error),
    );
    win.requestAnimationFrame = (callback) => throttle.request(callback);
    win.cancelAnimationFrame = (id) => throttle.cancel(id);
  }

  const update = (next: RendererSettings) => {
    settings = next;
    storage.write(STORAGE_KEY, settings);
    for (const listener of listeners) listener(settings);
  };

  return {
    get settings() {
      return settings;
    },
    setRenderer(renderer) {
      if (renderer === settings.renderer) return;
      update({ ...settings, renderer });
      reload();
    },
    setFps(fps) {
      update({ ...settings, fps: clampFps(fps) });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
