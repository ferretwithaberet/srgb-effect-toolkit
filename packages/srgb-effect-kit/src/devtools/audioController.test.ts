// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioFrame } from './audio';
import {
  createAudioController,
  openAudioCapture,
  type AudioSource,
  type OpenAudioCapture,
} from './audioController';
import type { FrameScheduler } from './context';
import { createEngineMock } from './engine';
import { createStorage } from './storage';

const KEY = 'srgb-effect-kit:Audio Test:audio';

/** A rAF that only runs when `tick()` is called. */
const fakeRaf = () => {
  let queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const raf: FrameScheduler = {
    request: (callback) => {
      queue.set(nextId, callback);
      return nextId++;
    },
    cancel: (id) => void queue.delete(id),
  };
  const tick = () => {
    const callbacks = queue;
    queue = new Map();
    for (const callback of callbacks.values()) callback(0);
  };
  return { raf, tick, pending: () => queue.size };
};

const frame = (level: number): AudioFrame => ({ level, width: 0.5, density: 0.5, freq: [9] });

const setup = (openCapture: OpenAudioCapture = vi.fn()) => {
  const { audio } = createEngineMock();
  const { raf, tick, pending } = fakeRaf();
  const controller = createAudioController(
    audio,
    createStorage('Audio Test', () => localStorage),
    raf,
    openCapture,
  );
  return { audio, controller, tick, pending };
};

beforeEach(() => localStorage.clear());

describe('createAudioController', () => {
  it('starts silent', () => {
    const { audio, controller, pending } = setup();
    expect(controller.mode).toBe('silent');
    expect(audio.level).toBe(-100);
    expect(pending()).toBe(0);
  });

  it('writes random frames every animation frame, in place', async () => {
    const { audio, controller, tick } = setup();
    const freq = audio.freq;
    await controller.setMode('random');
    expect(audio.level).toBeGreaterThanOrEqual(-60);
    const first = [...audio.freq];
    tick();
    expect(audio.freq).toBe(freq);
    expect(audio.freq).not.toEqual(first);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ mode: 'random' });
  });

  it('stops the loop and writes silence when switching back to silent', async () => {
    const { audio, controller, tick, pending } = setup();
    await controller.setMode('random');
    await controller.setMode('silent');
    tick();
    expect(pending()).toBe(0);
    expect(audio.level).toBe(-100);
    expect(audio.freq.every((band) => band === 0)).toBe(true);
  });

  it('restores random from storage', () => {
    localStorage.setItem(KEY, JSON.stringify({ mode: 'random' }));
    const { controller, audio } = setup();
    expect(controller.mode).toBe('random');
    expect(audio.level).toBeGreaterThan(-100);
  });

  it('does not restore capture modes, which need a user gesture', () => {
    localStorage.setItem(KEY, JSON.stringify({ mode: 'system' }));
    const open = vi.fn();
    expect(setup(open).controller.mode).toBe('silent');
    expect(open).not.toHaveBeenCalled();
  });

  it('runs a capture source and stops it on the next mode change', async () => {
    const source: AudioSource = { read: () => frame(-12), stop: vi.fn() };
    const { audio, controller, tick } = setup(async () => source);
    await controller.setMode('microphone');
    expect(controller.mode).toBe('microphone');
    expect(audio.level).toBe(-12);
    tick();
    await controller.setMode('silent');
    expect(source.stop).toHaveBeenCalledOnce();
  });

  it('falls back to silent with an error when capture fails', async () => {
    const { audio, controller } = setup(async () => {
      throw new Error('Permission denied');
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.setMode('system');
    expect(controller.mode).toBe('silent');
    expect(controller.error).toBe('Permission denied');
    expect(audio.level).toBe(-100);
    expect(listener).toHaveBeenCalled();
    await controller.setMode('random');
    expect(controller.error).toBeUndefined();
  });

  it('goes silent when the user stops sharing', async () => {
    let ended = () => {};
    const source: AudioSource = { read: () => frame(-6), stop: vi.fn() };
    const { controller, pending } = setup(async (_kind, onEnded) => {
      ended = onEnded;
      return source;
    });
    await controller.setMode('system');
    expect(pending()).toBe(1);
    ended();
    await Promise.resolve();
    expect(controller.mode).toBe('silent');
    expect(source.stop).toHaveBeenCalledOnce();
    expect(pending()).toBe(0);
    expect(controller.error).toBe('Audio capture ended.');
  });

  it('writes silence and persists silent while a capture prompt is open', async () => {
    const { audio, controller } = setup(() => new Promise<AudioSource>(() => {}));
    await controller.setMode('random');
    void controller.setMode('microphone');
    expect(audio.level).toBe(-100);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ mode: 'silent' });
  });

  it('stops a source whose first read throws', async () => {
    const source: AudioSource = {
      read: () => {
        throw new Error('boom');
      },
      stop: vi.fn(),
    };
    const { audio, controller, pending } = setup(async () => source);
    await controller.setMode('microphone');
    expect(source.stop).toHaveBeenCalledOnce();
    expect(controller.mode).toBe('silent');
    expect(controller.error).toBe('boom');
    expect(audio.level).toBe(-100);
    expect(pending()).toBe(0);
  });

  it('stops a source whose read throws on a later frame', async () => {
    let calls = 0;
    const source: AudioSource = {
      read: () => {
        if (++calls > 1) throw new Error('later');
        return frame(-9);
      },
      stop: vi.fn(),
    };
    const { audio, controller, tick, pending } = setup(async () => source);
    const listener = vi.fn();
    await controller.setMode('system');
    controller.subscribe(listener);
    tick();
    expect(source.stop).toHaveBeenCalledOnce();
    expect(controller.mode).toBe('silent');
    expect(controller.error).toBe('later');
    expect(audio.level).toBe(-100);
    expect(pending()).toBe(0);
    expect(listener).toHaveBeenCalled();
  });

  it('drops a capture that resolves after a newer mode was chosen', async () => {
    let resolve: (source: AudioSource) => void = () => {};
    const source: AudioSource = { read: () => frame(-3), stop: vi.fn() };
    const { audio, controller } = setup(() => new Promise<AudioSource>((done) => (resolve = done)));
    const pending = controller.setMode('system');
    await controller.setMode('random');
    resolve(source);
    await pending;
    expect(source.stop).toHaveBeenCalledOnce();
    expect(controller.mode).toBe('random');
    expect(audio.level).not.toBe(-3);
  });
});

describe('openAudioCapture', () => {
  const track = (kind: string) => {
    const listeners = new Map<string, () => void>();
    return {
      kind,
      stop: vi.fn(),
      getSettings: () => ({ channelCount: 2 }),
      addEventListener: vi.fn((type: string, fn: () => void) => listeners.set(type, fn)),
      removeEventListener: vi.fn((type: string) => listeners.delete(type)),
      fire: (type: string) => listeners.get(type)?.(),
    };
  };
  type FakeTrack = ReturnType<typeof track>;
  const fakeStream = (tracks: FakeTrack[]) => ({
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((t) => t.kind === 'audio'),
  });
  const fakeMedia = (tracks: FakeTrack[]) =>
    ({
      getUserMedia: vi.fn(async () => fakeStream(tracks)),
      getDisplayMedia: vi.fn(async () => fakeStream(tracks)),
    }) as unknown as MediaDevices;

  const nodes: { disconnect: ReturnType<typeof vi.fn> }[] = [];
  const contexts: { state: string; close: ReturnType<typeof vi.fn> }[] = [];
  let failSetup = false;

  beforeEach(() => {
    nodes.length = 0;
    contexts.length = 0;
    failSetup = false;
    const node = () => {
      const created = {
        disconnect: vi.fn(),
        connect: vi.fn(),
        fftSize: 0,
        smoothingTimeConstant: 0,
        frequencyBinCount: 256,
        getFloatTimeDomainData: vi.fn(),
        getByteFrequencyData: vi.fn(),
      };
      nodes.push(created);
      return created;
    };
    class FakeContext {
      state = 'running';
      close = vi.fn(async () => {
        this.state = 'closed';
      });
      resume = vi.fn(async () => {});
      constructor() {
        contexts.push(this);
      }
      createMediaStreamSource = node;
      createChannelSplitter = () => {
        if (failSetup) throw new Error('setup failed');
        return node();
      };
      createAnalyser = node;
    }
    vi.stubGlobal('AudioContext', FakeContext);
    vi.stubGlobal('MediaStream', class {});
  });

  it('stops every track, including video, and tears the graph down on stop()', async () => {
    const tracks = [track('audio'), track('video')];
    const source = await openAudioCapture('system', () => {}, fakeMedia(tracks));
    source.stop();
    for (const t of tracks) expect(t.stop).toHaveBeenCalledOnce();
    for (const t of tracks) expect(t.removeEventListener).toHaveBeenCalled();
    for (const n of nodes) expect(n.disconnect).toHaveBeenCalled();
    expect(contexts[0]!.close).toHaveBeenCalledOnce();
    source.stop();
    expect(contexts[0]!.close).toHaveBeenCalledOnce();
  });

  it('reports a missing audio track and stops all tracks', async () => {
    const tracks = [track('video')];
    await expect(openAudioCapture('system', () => {}, fakeMedia(tracks))).rejects.toThrow(
      /^\[srgb-effect\] No audio was shared/,
    );
    expect(tracks[0]!.stop).toHaveBeenCalledOnce();
  });

  it('releases the stream and the context when setup throws', async () => {
    failSetup = true;
    const tracks = [track('audio'), track('video')];
    await expect(openAudioCapture('system', () => {}, fakeMedia(tracks))).rejects.toThrow(
      'setup failed',
    );
    for (const t of tracks) expect(t.stop).toHaveBeenCalledOnce();
    expect(contexts[0]!.close).toHaveBeenCalledOnce();
  });

  it('needs a secure context: reports missing mediaDevices or methods with a prefix', async () => {
    await expect(openAudioCapture('microphone', () => {}, undefined)).rejects.toThrow(
      '[srgb-effect] audio capture needs a secure context (https or localhost)',
    );
    const withoutDisplay = { getUserMedia: vi.fn() } as unknown as MediaDevices;
    await expect(openAudioCapture('system', () => {}, withoutDisplay)).rejects.toThrow(
      '[srgb-effect] audio capture needs a secure context (https or localhost)',
    );
    const withoutUser = { getDisplayMedia: vi.fn() } as unknown as MediaDevices;
    await expect(openAudioCapture('microphone', () => {}, withoutUser)).rejects.toThrow(
      '[srgb-effect] audio capture needs a secure context (https or localhost)',
    );
  });

  it('stops all tracks when the AudioContext constructor throws', async () => {
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('no audio context');
        }
      },
    );
    const tracks = [track('audio'), track('video')];
    await expect(openAudioCapture('system', () => {}, fakeMedia(tracks))).rejects.toThrow(
      'no audio context',
    );
    for (const t of tracks) expect(t.stop).toHaveBeenCalledOnce();
  });

  it('falls back to silent with the secure-context error in the controller', async () => {
    const { audio } = createEngineMock();
    const { raf } = fakeRaf();
    const controller = createAudioController(
      audio,
      createStorage('Audio Test', () => localStorage),
      raf,
      (kind, onEnded) => openAudioCapture(kind, onEnded, undefined),
    );
    await controller.setMode('microphone');
    expect(controller.mode).toBe('silent');
    expect(controller.error).toBe(
      '[srgb-effect] audio capture needs a secure context (https or localhost)',
    );
  });

  it('calls onEnded once when any track ends', async () => {
    const tracks = [track('audio'), track('video')];
    const onEnded = vi.fn();
    await openAudioCapture('system', onEnded, fakeMedia(tracks));
    tracks[1]!.fire('ended');
    tracks[0]!.fire('ended');
    expect(onEnded).toHaveBeenCalledOnce();
  });

  it('falls back to silent when the video track ends', async () => {
    const tracks = [track('audio'), track('video')];
    const { audio } = createEngineMock();
    const { raf, pending } = fakeRaf();
    const controller = createAudioController(
      audio,
      createStorage('Audio Test', () => localStorage),
      raf,
      (kind, onEnded) => openAudioCapture(kind, onEnded, fakeMedia(tracks)),
    );
    await controller.setMode('system');
    expect(controller.mode).toBe('system');
    tracks[1]!.fire('ended');
    await Promise.resolve();
    expect(controller.mode).toBe('silent');
    for (const t of tracks) expect(t.stop).toHaveBeenCalledOnce();
    expect(pending()).toBe(0);
  });
});
