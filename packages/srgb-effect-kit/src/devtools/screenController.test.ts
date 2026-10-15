// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST } from '../../test/helpers/devtools';
import { getZone } from '../runtime/zones';
import type { FrameScheduler } from './context';
import { createEngineMock } from './engine';
import {
  CAPTURE_INTERVAL_MS,
  createScreenController,
  openScreenCapture,
  type CaptureFrame,
  type FrameSource,
  type OpenScreenCapture,
} from './screenController';
import { createStorage } from './storage';

const PREFIX = 'srgb-effect-kit:Screen Test:';

/** A 1920×1080 screen downscaled to 192×108, entirely `rgb`. */
const solidFrame = (rgb: [number, number, number]): CaptureFrame => {
  const width = 192;
  const height = 108;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) pixels.set([...rgb, 255], i * 4);
  return { pixels, width, height, sourceWidth: 1920, sourceHeight: 1080 };
};

/** A rAF on a manual clock: `advance(ms)` runs one frame `ms` later. */
const fakeRaf = () => {
  let queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let now = 0;
  const raf: FrameScheduler = {
    request: (callback) => {
      queue.set(nextId, callback);
      return nextId++;
    },
    cancel: (id) => void queue.delete(id),
  };
  const advance = (ms: number) => {
    now += ms;
    const callbacks = queue;
    queue = new Map();
    for (const callback of callbacks.values()) callback(now);
  };
  return { raf, advance, pending: () => queue.size };
};

const setup = (openCapture: OpenScreenCapture = vi.fn()) => {
  const { raf, advance, pending } = fakeRaf();
  const engine = createEngineMock(MANIFEST.meters);
  const controller = createScreenController(
    engine,
    MANIFEST.meters,
    createStorage('Screen Test', () => localStorage),
    raf,
    openCapture,
  );
  return { engine, controller, advance, pending };
};

beforeEach(() => localStorage.clear());

describe('createScreenController', () => {
  it('starts with a black screen and initial meter values', () => {
    const { engine, controller } = setup();
    expect(controller.source).toEqual({ kind: 'solid', color: '#000000' });
    expect(getZone(5, 5, engine.zone)).toEqual({ h: 0, s: 0, l: 0 });
    expect({ ...engine.vision }).toEqual({ health: 0, mana: 0, victory: 0, score: -1 });
  });

  it('fills zones from solid and gradient sources and persists them', async () => {
    const { engine, controller } = setup();
    await controller.setSource({ kind: 'solid', color: '#00ff00' });
    expect(getZone(0, 0, engine.zone)).toEqual({ h: 120, s: 100, l: 50 });
    await controller.setSource({ kind: 'gradient', from: '#000000', to: '#ffffff' });
    expect(getZone(27, 0, engine.zone).l).toBe(100);
    expect(JSON.parse(localStorage.getItem(`${PREFIX}screen`)!)).toEqual({
      kind: 'gradient',
      from: '#000000',
      to: '#ffffff',
    });
  });

  it('restores the persisted source and manual meter values', () => {
    localStorage.setItem(`${PREFIX}screen`, JSON.stringify({ kind: 'solid', color: '#ff0000' }));
    localStorage.setItem(
      `${PREFIX}meters`,
      JSON.stringify({ health: 0.25, score: 7.4, mana: 'x' }),
    );
    const { engine } = setup();
    expect(getZone(0, 0, engine.zone).s).toBe(100);
    expect(engine.vision.health).toBe(0.25);
    expect(engine.vision.score).toBe(7);
    expect(engine.vision.mana).toBe(0);
  });

  it('ignores persisted captures and invalid sources', () => {
    localStorage.setItem(`${PREFIX}screen`, JSON.stringify({ kind: 'capture' }));
    expect(setup().controller.source.kind).toBe('solid');
    localStorage.setItem(`${PREFIX}screen`, JSON.stringify({ kind: 'solid', color: 'red' }));
    expect(setup().controller.source).toEqual({ kind: 'solid', color: '#000000' });
  });

  it('clamps and persists manual meter values', () => {
    const { engine, controller } = setup();
    controller.setMeter('health', 2);
    controller.setMeter('victory', -0.7);
    controller.setMeter('missing', 1);
    expect(engine.vision.health).toBe(1);
    expect(engine.vision.victory).toBe(-1);
    expect(JSON.parse(localStorage.getItem(`${PREFIX}meters`)!)).toMatchObject({
      health: 1,
      victory: -1,
    });
  });

  it('samples a capture into zones and linear/area meters, leaving OCR meters manual', async () => {
    let current = solidFrame([0, 200, 0]);
    const source: FrameSource = { read: () => current, stop: vi.fn() };
    const { engine, controller, advance } = setup(async () => source);
    controller.setMeter('victory', 1);
    await controller.setSource({ kind: 'capture' });

    expect(controller.frame).toBe(current);
    expect(getZone(0, 0, engine.zone)).toEqual({ h: 120, s: 100, l: 39.2 });
    expect(engine.vision.health).toBe(1);
    expect(engine.vision.mana).toBe(0);
    expect(engine.vision.victory).toBe(1);
    expect(controller.isAutomatic('health')).toBe(true);
    expect(controller.isAutomatic('victory')).toBe(false);

    current = solidFrame([0, 0, 200]);
    advance(1);
    advance(CAPTURE_INTERVAL_MS);
    expect(engine.vision.health).toBe(0);
    expect(engine.vision.mana).toBe(1);
  });

  it('restores manual values and stops the capture when switching away', async () => {
    const source: FrameSource = { read: () => solidFrame([0, 200, 0]), stop: vi.fn() };
    const { engine, controller } = setup(async () => source);
    controller.setMeter('health', 0.5);
    await controller.setSource({ kind: 'capture' });
    expect(engine.vision.health).toBe(1);
    await controller.setSource({ kind: 'solid', color: '#000000' });
    expect(source.stop).toHaveBeenCalledOnce();
    expect(engine.vision.health).toBe(0.5);
    expect(controller.isAutomatic('health')).toBe(false);
    expect(controller.frame).toBeUndefined();
  });

  it('falls back to the previous source when capture fails or ends', async () => {
    let ended = () => {};
    const stop = vi.fn();
    const { controller, pending } = setup(async (onEnded) => {
      ended = onEnded;
      return { read: () => solidFrame([0, 200, 0]), stop };
    });
    await controller.setSource({ kind: 'solid', color: '#123456' });
    await controller.setSource({ kind: 'capture' });
    expect(pending()).toBe(1);
    ended();
    await Promise.resolve();
    expect(controller.source).toEqual({ kind: 'solid', color: '#123456' });
    expect(stop).toHaveBeenCalledOnce();
    expect(pending()).toBe(0);
    expect(controller.error).toBeUndefined();
    expect(controller.frame).toBeUndefined();

    const failing = setup(async () => {
      throw new Error('Permission denied');
    }).controller;
    await failing.setSource({ kind: 'capture' });
    expect(failing.source.kind).toBe('solid');
    expect(failing.error).toBe('Permission denied');
  });
});

describe('capture hygiene', () => {
  const open = (read: FrameSource['read']) => {
    const source: FrameSource = { read, stop: vi.fn() };
    return { source, ...setup(async () => source) };
  };

  it('throttles the loop to the capture interval and cancels it on stop', async () => {
    const read = vi.fn(() => solidFrame([0, 200, 0]));
    const { controller, advance, pending, source } = open(read);
    await controller.setSource({ kind: 'capture' });
    expect(read).toHaveBeenCalledTimes(1);
    advance(1); // anchors the interval; no second sample of the first frame
    expect(read).toHaveBeenCalledTimes(1);
    advance(CAPTURE_INTERVAL_MS / 2);
    expect(read).toHaveBeenCalledTimes(1);
    advance(CAPTURE_INTERVAL_MS / 2);
    expect(read).toHaveBeenCalledTimes(2);
    expect(pending()).toBe(1);
    await controller.setSource({ kind: 'solid', color: '#000000' });
    expect(pending()).toBe(0);
    expect(source.stop).toHaveBeenCalledOnce();
  });

  it('keeps a steady 100 ms cadence on a 60 Hz clock and catches up after a stall', async () => {
    const read = vi.fn(() => solidFrame([0, 200, 0]));
    const { controller, advance } = open(read);
    await controller.setSource({ kind: 'capture' });
    advance(16);
    read.mockClear();
    for (let i = 0; i < 60; i += 1) advance(16.67);
    // 1000 ms of 16.67 ms frames: about 10 samples, not the ~8 a reset-to-now cadence gives.
    expect(read.mock.calls.length).toBeGreaterThanOrEqual(9);
    read.mockClear();
    advance(1000); // a long stall samples once, then resumes the cadence
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('writes manual values straight away when capture is re-opened', async () => {
    let resolve: (source: FrameSource) => void = () => {};
    let first = true;
    const source: FrameSource = { read: () => solidFrame([0, 200, 0]), stop: vi.fn() };
    const { controller, engine } = setup(() =>
      first ? ((first = false), Promise.resolve(source)) : new Promise((r) => (resolve = r)),
    );
    controller.setMeter('health', 0.5);
    await controller.setSource({ kind: 'capture' });
    expect(engine.vision.health).toBe(1);
    const reopening = controller.setSource({ kind: 'capture' });
    expect(source.stop).toHaveBeenCalledOnce();
    expect(engine.vision.health).toBe(0.5);
    resolve({ read: () => undefined, stop: vi.fn() });
    await reopening;
  });

  it('stops the capture and falls back to the default source when the first read throws', async () => {
    const { controller, engine, pending, source } = open(() => {
      throw new Error('first read failed');
    });
    await controller.setSource({ kind: 'solid', color: '#123456' });
    await controller.setSource({ kind: 'capture' });
    expect(source.stop).toHaveBeenCalledOnce();
    expect(controller.error).toBe('first read failed');
    expect(controller.source).toEqual({ kind: 'solid', color: '#000000' });
    expect(controller.isAutomatic('health')).toBe(false);
    expect(getZone(0, 0, engine.zone).l).toBe(0);
    expect(pending()).toBe(0);
  });

  it('stops the capture and falls back to the default source when a later read throws', async () => {
    let fail = false;
    const { controller, advance, pending, source } = open(() => {
      if (fail) throw new Error('lost the frame');
      return solidFrame([0, 200, 0]);
    });
    await controller.setSource({ kind: 'capture' });
    advance(1);
    fail = true;
    advance(CAPTURE_INTERVAL_MS);
    expect(source.stop).toHaveBeenCalledOnce();
    expect(controller.error).toBe('lost the frame');
    expect(controller.source).toEqual({ kind: 'solid', color: '#000000' });
    expect(controller.frame).toBeUndefined();
    expect(pending()).toBe(0);
    advance(CAPTURE_INTERVAL_MS);
    expect(source.stop).toHaveBeenCalledOnce();
  });

  it('falls back when sampling the frame throws', async () => {
    const bad = solidFrame([0, 0, 0]);
    Object.defineProperty(bad, 'pixels', {
      get() {
        throw new Error('unreadable pixels');
      },
    });
    const { controller, source } = open(() => bad);
    await controller.setSource({ kind: 'capture' });
    expect(source.stop).toHaveBeenCalledOnce();
    expect(controller.error).toBe('unreadable pixels');
    expect(controller.source.kind).toBe('solid');
  });

  it('stops a capture that opens after a newer source was chosen', async () => {
    let resolve: (source: FrameSource) => void = () => {};
    const { controller, pending } = setup(() => new Promise((r) => (resolve = r)));
    const opening = controller.setSource({ kind: 'capture' });
    await controller.setSource({ kind: 'solid', color: '#000000' });
    const source: FrameSource = { read: () => solidFrame([0, 200, 0]), stop: vi.fn() };
    resolve(source);
    await opening;
    expect(source.stop).toHaveBeenCalledOnce();
    expect(pending()).toBe(0);
  });

  it('does not restore a capture after a reload', async () => {
    const first = open(() => solidFrame([0, 200, 0]));
    await first.controller.setSource({ kind: 'capture' });
    const openCapture = vi.fn();
    const second = setup(openCapture);
    expect(second.controller.source.kind).toBe('solid');
    expect(openCapture).not.toHaveBeenCalled();
  });
});

type Listener = () => void;

/** A fake MediaStream whose tracks record their `ended` listeners. */
const fakeStream = (kinds: string[]) => {
  const tracks = kinds.map((kind) => {
    const listeners = new Set<Listener>();
    return {
      kind,
      listeners,
      stop: vi.fn(),
      addEventListener: (_type: string, listener: Listener) => void listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) => void listeners.delete(listener),
      end: () => [...listeners].forEach((listener) => listener()),
    };
  });
  const stream = {
    getTracks: () => tracks,
    getVideoTracks: () => tracks.filter((track) => track.kind === 'video'),
  };
  const media = { getDisplayMedia: vi.fn(async () => stream) } as unknown as MediaDevices;
  return { tracks, media };
};

describe('openScreenCapture', () => {
  const fakes = (options: { play?: () => Promise<void>; context?: unknown } = {}) => {
    const video = {
      muted: false,
      playsInline: false,
      srcObject: null as unknown,
      videoWidth: 1920,
      videoHeight: 1080,
      play: options.play ?? (async () => {}),
    };
    const context =
      'context' in options
        ? options.context
        : {
            drawImage: vi.fn(),
            getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
              data: new Uint8ClampedArray(w * h * 4),
            })),
          };
    const canvas = { width: 0, height: 0, getContext: vi.fn(() => context) };
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'video' ? video : tag === 'canvas' ? canvas : create(tag)) as never);
    return { video, canvas, context };
  };

  it('reads frames scaled to the sample width', async () => {
    const { media } = fakeStream(['video']);
    const { canvas } = fakes();
    const source = await openScreenCapture(() => {}, media);
    const frame = source.read()!;
    expect([frame.width, frame.height]).toEqual([480, 270]);
    expect([frame.sourceWidth, frame.sourceHeight]).toEqual([1920, 1080]);
    expect([canvas.width, canvas.height]).toEqual([480, 270]);
  });

  it('stops every track and rethrows when the video cannot play', async () => {
    const { media, tracks } = fakeStream(['video', 'audio']);
    const { video } = fakes({ play: () => Promise.reject(new Error('play blocked')) });
    await expect(openScreenCapture(() => {}, media)).rejects.toThrow('play blocked');
    for (const track of tracks) {
      expect(track.stop).toHaveBeenCalledOnce();
      expect(track.listeners.size).toBe(0);
    }
    expect(video.srcObject).toBeNull();
  });

  it('stops every track and rethrows when creating the video throws', async () => {
    const { media, tracks } = fakeStream(['video']);
    vi.spyOn(document, 'createElement').mockImplementation(() => {
      throw new Error('no video element');
    });
    await expect(openScreenCapture(() => {}, media)).rejects.toThrow('no video element');
    expect(tracks[0]!.stop).toHaveBeenCalledOnce();
    expect(tracks[0]!.listeners.size).toBe(0);
  });

  it('stops every track and rethrows when the canvas context cannot be created', async () => {
    const { media, tracks } = fakeStream(['video']);
    fakes({ context: null });
    await expect(openScreenCapture(() => {}, media)).rejects.toThrow(/2D canvas/);
    expect(tracks[0]!.stop).toHaveBeenCalledOnce();
    expect(tracks[0]!.listeners.size).toBe(0);
  });

  it('explains that capture needs a secure context', async () => {
    await expect(openScreenCapture(() => {}, undefined)).rejects.toThrow(
      '[srgb-effect] screen capture needs a secure context (https or localhost)',
    );
    await expect(openScreenCapture(() => {}, {} as MediaDevices)).rejects.toThrow(/secure context/);
  });

  it('stops the tracks of a share without video', async () => {
    const { media, tracks } = fakeStream(['audio']);
    await expect(openScreenCapture(() => {}, media)).rejects.toThrow(
      '[srgb-effect] No video was shared.',
    );
    expect(tracks[0]!.stop).toHaveBeenCalledOnce();
  });

  it('reports the end of the share once, however many tracks end, and detaches on stop', async () => {
    const { media, tracks } = fakeStream(['video', 'audio']);
    fakes();
    const onEnded = vi.fn();
    const source = await openScreenCapture(onEnded, media);
    expect(tracks.map((track) => track.listeners.size)).toEqual([1, 1]);
    tracks[0]!.end();
    tracks[1]!.end();
    expect(onEnded).toHaveBeenCalledOnce();

    source.stop();
    expect(tracks.map((track) => track.listeners.size)).toEqual([0, 0]);
    for (const track of tracks) expect(track.stop).toHaveBeenCalledOnce();
    tracks[0]!.end();
    expect(onEnded).toHaveBeenCalledOnce();
  });
});
