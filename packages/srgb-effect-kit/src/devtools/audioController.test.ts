// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioFrame } from './audio';
import { createAudioController, type AudioSource, type OpenAudioCapture } from './audioController';
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
    const { controller } = setup(async (_kind, onEnded) => {
      ended = onEnded;
      return { read: () => frame(-6), stop: vi.fn() };
    });
    await controller.setMode('system');
    ended();
    await Promise.resolve();
    expect(controller.mode).toBe('silent');
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
