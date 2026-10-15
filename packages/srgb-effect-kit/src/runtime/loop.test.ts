import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoop, type LoopInfo } from './loop';

let queue: Map<number, FrameRequestCallback>;
let nextId: number;

/** Runs every pending rAF callback with the given timestamp (one display refresh). */
const tick = (timestamp: number) => {
  const callbacks = [...queue.values()];
  queue.clear();
  for (const callback of callbacks) callback(timestamp);
};

beforeEach(() => {
  queue = new Map();
  nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createLoop', () => {
  it('calls frame on every refresh with dt, time and frameCount', () => {
    const infos: LoopInfo[] = [];
    const loop = createLoop((info) => infos.push(info));
    loop.start();
    tick(1000);
    tick(1016);
    tick(1050);
    expect(infos).toEqual([
      { dt: 0, time: 0, frameCount: 1 },
      { dt: 0.016, time: 0.016, frameCount: 2 },
      { dt: 0.034, time: 0.05, frameCount: 3 },
    ]);
  });

  it('caps the frame rate by skipping refreshes', () => {
    const frame = vi.fn();
    const loop = createLoop(frame, { maxFps: 30 });
    loop.start();
    for (let i = 0; i <= 60; i += 1) tick(1000 + i * (1000 / 60));
    // 61 refreshes over one second at 60 Hz render 31 frames at a 30 fps cap (both ends included).
    expect(frame).toHaveBeenCalledTimes(31);
  });

  it('tolerates refresh jitter below the cap interval', () => {
    const frame = vi.fn();
    const loop = createLoop(frame, { maxFps: 30 });
    loop.start();
    tick(0);
    tick(33); // 0.33ms short of 33.33ms, but within tolerance
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it('stops and restarts', () => {
    const frame = vi.fn();
    const loop = createLoop(frame);
    loop.start();
    loop.start(); // idempotent
    tick(0);
    expect(loop.running).toBe(true);
    loop.stop();
    expect(loop.running).toBe(false);
    tick(16);
    expect(frame).toHaveBeenCalledTimes(1);
    loop.start();
    tick(32);
    tick(48);
    expect(frame).toHaveBeenCalledTimes(3);
    expect(frame.mock.calls[1]![0]).toMatchObject({ dt: 0, time: 0, frameCount: 2 });
    expect(frame.mock.calls[2]![0]).toMatchObject({ dt: 0.016, time: 0.016, frameCount: 3 });
  });

  it('treats invalid caps as uncapped', () => {
    const frame = vi.fn();
    const loop = createLoop(frame, { maxFps: 0 });
    loop.start();
    tick(0);
    tick(16);
    expect(frame).toHaveBeenCalledTimes(2);
    loop.setMaxFps(Number.NaN);
    tick(32);
    expect(frame).toHaveBeenCalledTimes(3);
  });

  it('changes the cap while running', () => {
    const frame = vi.fn();
    const loop = createLoop(frame, { maxFps: 10 });
    loop.start();
    tick(0);
    tick(50);
    expect(frame).toHaveBeenCalledTimes(1);
    loop.setMaxFps(undefined);
    tick(66);
    expect(frame).toHaveBeenCalledTimes(2);
  });
});
