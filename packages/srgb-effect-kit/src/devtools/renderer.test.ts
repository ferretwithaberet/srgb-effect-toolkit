// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDevtoolsWindow } from '../../test/helpers/devtools';
import { detectRenderer } from '../runtime/renderer';
import type { FrameScheduler } from './context';
import {
  clampFps,
  createRafThrottle,
  installRendererSimulation,
  overrideUserAgent,
  SIMULATED_USER_AGENTS,
} from './renderer';
import { createStorage } from './storage';

/** A native rAF driven by `tick(timestamp)`, one call per display refresh. */
const fakeNative = () => {
  let queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const native: FrameScheduler = {
    request: (callback) => {
      queue.set(nextId, callback);
      return nextId++;
    },
    cancel: (id) => void queue.delete(id),
  };
  const tick = (timestamp: number) => {
    const callbacks = queue;
    queue = new Map();
    for (const callback of callbacks.values()) callback(timestamp);
  };
  return { native, tick, pending: () => queue.size };
};

/** Runs `refreshes` 60 Hz refreshes starting at t=1000 and keeps `request` looping like a render loop. */
const runLoop = (scheduler: FrameScheduler, tick: (t: number) => void, refreshes: number) => {
  const frames: number[] = [];
  const frame = (timestamp: number) => {
    frames.push(timestamp);
    scheduler.request(frame);
  };
  scheduler.request(frame);
  for (let i = 0; i < refreshes; i += 1) tick(1000 + i * (1000 / 60));
  return frames;
};

const userAgent = navigator.userAgent;
const nativeRaf = window.requestAnimationFrame;
const nativeCaf = window.cancelAnimationFrame;
const storage = () => createStorage('Renderer Test', () => localStorage);

beforeEach(() => resetDevtoolsWindow());
afterEach(() => {
  overrideUserAgent(navigator, userAgent);
  window.requestAnimationFrame = nativeRaf;
  window.cancelAnimationFrame = nativeCaf;
});

describe('simulated user agents', () => {
  it('match the runtime renderer signatures', () => {
    expect(detectRenderer(SIMULATED_USER_AGENTS.ultralight)).toBe('ultralight');
    expect(detectRenderer(SIMULATED_USER_AGENTS.qtwebengine)).toBe('qtwebengine');
  });

  it('override navigator.userAgent', () => {
    overrideUserAgent(navigator, SIMULATED_USER_AGENTS.qtwebengine);
    expect(navigator.userAgent).toBe(SIMULATED_USER_AGENTS.qtwebengine);
    expect(detectRenderer()).toBe('qtwebengine');
  });
});

describe('createRafThrottle', () => {
  it('runs a 60 Hz loop at the FPS setting', () => {
    const { native, tick } = fakeNative();
    // 61 refreshes span one second; both ends render, as with createLoop's cap.
    expect(
      runLoop(
        createRafThrottle(native, () => 30),
        tick,
        61,
      ),
    ).toHaveLength(31);
    const fresh = fakeNative();
    expect(
      runLoop(
        createRafThrottle(fresh.native, () => 20),
        fresh.tick,
        61,
      ),
    ).toHaveLength(21);
    const full = fakeNative();
    expect(
      runLoop(
        createRafThrottle(full.native, () => 60),
        full.tick,
        61,
      ),
    ).toHaveLength(61);
  });

  it('follows FPS changes immediately', () => {
    const { native, tick } = fakeNative();
    let fps = 60;
    const throttle = createRafThrottle(native, () => fps);
    const frames: number[] = [];
    const frame = (t: number) => {
      frames.push(t);
      throttle.request(frame);
    };
    throttle.request(frame);
    for (let i = 0; i < 30; i += 1) tick(1000 + i * (1000 / 60));
    fps = 20;
    for (let i = 30; i < 90; i += 1) tick(1000 + i * (1000 / 60));
    expect(frames.length).toBe(30 + 20);
  });

  it('isolates a throwing callback so the others in the frame still run', () => {
    const { native, tick } = fakeNative();
    const report = vi.fn();
    const throttle = createRafThrottle(native, () => 60, report);
    const error = new Error('boom');
    const second = vi.fn();
    throttle.request(() => {
      throw error;
    });
    throttle.request(second);
    tick(1000);
    expect(second).toHaveBeenCalledWith(1000);
    expect(report).toHaveBeenCalledWith(error);
  });

  it('reports through the global reportError by default', () => {
    vi.stubGlobal('reportError', vi.fn());
    const { native, tick } = fakeNative();
    const error = new Error('boom');
    createRafThrottle(native, () => 60).request(() => {
      throw error;
    });
    tick(1000);
    expect(globalThis.reportError).toHaveBeenCalledWith(error);
    vi.unstubAllGlobals();
  });

  it('passes the refresh timestamp, supports cancel and stops requesting when idle', () => {
    const { native, tick, pending } = fakeNative();
    const throttle = createRafThrottle(native, () => 30);
    const kept = vi.fn();
    const cancelled = vi.fn();
    throttle.request(kept);
    throttle.cancel(throttle.request(cancelled));
    tick(1000);
    expect(kept).toHaveBeenCalledWith(1000);
    expect(cancelled).not.toHaveBeenCalled();
    expect(pending()).toBe(0);
  });
});

describe('installRendererSimulation', () => {
  it('leaves the browser untouched by default', () => {
    const { native } = fakeNative();
    const controller = installRendererSimulation(window, storage(), native, vi.fn());
    expect(controller.settings).toEqual({ renderer: 'browser', fps: 60 });
    expect(navigator.userAgent).toBe(userAgent);
    expect(window.requestAnimationFrame).toBe(nativeRaf);
  });

  it('simulates UltraLight: user agent and throttled rAF', () => {
    localStorage.setItem(
      'srgb-effect-kit:Renderer Test:renderer',
      JSON.stringify({ renderer: 'ultralight', fps: 30 }),
    );
    const { native, tick } = fakeNative();
    installRendererSimulation(window, storage(), native, vi.fn());
    expect(detectRenderer()).toBe('ultralight');
    const frames = runLoop(
      {
        request: (cb) => window.requestAnimationFrame(cb),
        cancel: (id) => window.cancelAnimationFrame(id),
      },
      tick,
      61,
    );
    expect(frames).toHaveLength(31);
  });

  it('simulates QtWebEngine with the native rAF rate', () => {
    localStorage.setItem(
      'srgb-effect-kit:Renderer Test:renderer',
      JSON.stringify({ renderer: 'qtwebengine', fps: 20 }),
    );
    installRendererSimulation(window, storage(), fakeNative().native, vi.fn());
    expect(detectRenderer()).toBe('qtwebengine');
    expect(window.requestAnimationFrame).toBe(nativeRaf);
  });

  it('persists FPS changes live and reloads on renderer changes', () => {
    const reload = vi.fn();
    const controller = installRendererSimulation(window, storage(), fakeNative().native, reload);
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setFps(45.4);
    expect(controller.settings.fps).toBe(45);
    expect(listener).toHaveBeenCalledWith({ renderer: 'browser', fps: 45 });
    expect(reload).not.toHaveBeenCalled();
    controller.setRenderer('browser');
    expect(reload).not.toHaveBeenCalled();
    controller.setRenderer('ultralight');
    expect(reload).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem('srgb-effect-kit:Renderer Test:renderer')!)).toEqual({
      renderer: 'ultralight',
      fps: 45,
    });
  });

  it('clamps a stored out-of-range FPS at install', () => {
    localStorage.setItem(
      'srgb-effect-kit:Renderer Test:renderer',
      JSON.stringify({ renderer: 'ultralight', fps: 5 }),
    );
    const controller = installRendererSimulation(window, storage(), fakeNative().native, vi.fn());
    expect(controller.settings).toEqual({ renderer: 'ultralight', fps: 20 });
  });

  it('ignores invalid stored settings and clamps the FPS', () => {
    localStorage.setItem('srgb-effect-kit:Renderer Test:renderer', '{"renderer":"netscape"}');
    expect(installRendererSimulation(window, storage(), fakeNative().native).settings).toEqual({
      renderer: 'browser',
      fps: 60,
    });
    expect([clampFps(5), clampFps(144), clampFps(Number.NaN), clampFps(29.6)]).toEqual([
      20, 60, 60, 30,
    ]);
  });
});
