// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DevtoolsContext } from '../../context';
import {
  canvasSourceRect,
  captureSourceRect,
  createViewTab,
  findCoveringCanvas,
  openTabCapture,
  type TabCapture,
} from './view';

const box = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

beforeEach(() => document.body.replaceChildren());

describe('SignalRGB view helpers', () => {
  it('finds the first canvas covering the visible area', () => {
    const small = document.createElement('canvas');
    const full = document.createElement('canvas');
    document.body.append(small, full);
    vi.spyOn(small, 'getBoundingClientRect').mockReturnValue(box(0, 0, 100, 100));
    vi.spyOn(full, 'getBoundingClientRect').mockReturnValue(box(0, 0, 320, 200));
    expect(findCoveringCanvas(document)).toBe(full);
    vi.spyOn(full, 'getBoundingClientRect').mockReturnValue(box(8, 8, 320, 200));
    expect(findCoveringCanvas(document)).toBeUndefined();
  });

  it('maps the visible area into canvas pixels, including CSS scaling and offsets', () => {
    expect(canvasSourceRect({ width: 320, height: 200 }, box(0, 0, 320, 200))).toEqual({
      sx: 0,
      sy: 0,
      sw: 320,
      sh: 200,
    });
    // A 640×400 backing store shown at 320×200 CSS pixels, scrolled 10px left.
    expect(canvasSourceRect({ width: 640, height: 400 }, box(-10, 0, 320, 200))).toEqual({
      sx: 20,
      sy: 0,
      sw: 640,
      sh: 400,
    });
  });

  it('maps the visible area into a tab capture', () => {
    expect(captureSourceRect(2560, 1600, 1280, 800)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 400 });
  });
});

const fakeTrack = () => {
  const listeners = new Set<() => void>();
  return {
    kind: 'video',
    stop: vi.fn(),
    addEventListener: vi.fn((_type: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: () => void) => listeners.delete(listener)),
    end: () => [...listeners].forEach((listener) => listener()),
    listeners,
  };
};
const fakeMedia = (track = fakeTrack(), tracks: unknown[] = [track]) => {
  const stream = { getTracks: () => tracks, getVideoTracks: () => tracks.filter(Boolean) };
  return {
    track,
    getDisplayMedia: vi.fn().mockResolvedValue(stream),
    media: undefined as unknown as MediaDevices,
  };
};
const mediaOf = (fake: ReturnType<typeof fakeMedia>) =>
  ({ getDisplayMedia: fake.getDisplayMedia }) as unknown as MediaDevices;

describe('openTabCapture', () => {
  afterEach(() => vi.restoreAllMocks());

  it('explains a missing mediaDevices', async () => {
    await expect(openTabCapture(vi.fn(), undefined)).rejects.toThrow(
      /^\[srgb-effect\] tab capture needs a secure context/,
    );
  });

  it('asks for the current tab', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const fake = fakeMedia();
    await openTabCapture(vi.fn(), mediaOf(fake));
    expect(fake.getDisplayMedia).toHaveBeenCalledWith({ video: true, preferCurrentTab: true });
  });

  it('releases the tracks when setup throws', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('blocked'));
    const fake = fakeMedia();
    await expect(openTabCapture(vi.fn(), mediaOf(fake))).rejects.toThrow('blocked');
    expect(fake.track.stop).toHaveBeenCalledOnce();
    expect(fake.track.listeners.size).toBe(0);
  });

  it('releases a stream without video', async () => {
    const track = fakeTrack();
    const fake = fakeMedia(track, [track]);
    const stream = await fake.getDisplayMedia();
    stream.getVideoTracks = () => [];
    fake.getDisplayMedia.mockResolvedValue(stream);
    await expect(openTabCapture(vi.fn(), mediaOf(fake))).rejects.toThrow('No video was shared');
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it('reports the end of sharing once and stops listening on stop', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
    const fake = fakeMedia();
    const onEnded = vi.fn();
    const capture = await openTabCapture(onEnded, mediaOf(fake));
    expect(fake.track.addEventListener).toHaveBeenCalledOnce();
    fake.track.end();
    fake.track.end();
    expect(onEnded).toHaveBeenCalledOnce();
    capture.stop();
    expect(fake.track.listeners.size).toBe(0);
    expect(fake.track.stop).toHaveBeenCalledOnce();
  });
});

describe('createViewTab', () => {
  const ctx = {
    imageSmoothingEnabled: true,
    clearRect: vi.fn(),
    drawImage: vi.fn(),
  };
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let now = 0;
  const raf = {
    request: vi.fn((callback: FrameRequestCallback) => {
      frames.set(nextId, callback);
      return nextId++;
    }),
    cancel: vi.fn((id: number) => void frames.delete(id)),
  };
  const step = (ms: number) => {
    now += ms;
    const due = [...frames.values()];
    frames.clear();
    due.forEach((callback) => callback(now));
  };
  const video = () => {
    const element = document.createElement('video');
    Object.defineProperty(element, 'videoWidth', { value: 2560 });
    Object.defineProperty(element, 'videoHeight', { value: 1600 });
    return element;
  };
  const mount = (open: (onEnded: () => void) => Promise<TabCapture>) => {
    const tab = createViewTab(
      {
        win: window,
        renderer: { settings: { fps: 30 } },
        raf,
      } as unknown as DevtoolsContext,
      open,
    );
    const find = <T extends HTMLElement>(selector: string) =>
      tab.element.querySelector<T>(`[data-srgb-devtools="${selector}"]`)!;
    return { tab, find };
  };
  const flush = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    frames.clear();
    now = 0;
    ctx.drawImage.mockReset();
    ctx.clearRect.mockReset();
    raf.request.mockClear();
    raf.cancel.mockClear();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
  });
  afterEach(() => vi.restoreAllMocks());

  it('samples a covering canvas at the FPS setting, on the injected rAF', () => {
    const page = document.createElement('canvas');
    document.body.append(page);
    vi.spyOn(page, 'getBoundingClientRect').mockReturnValue(box(0, 0, 320, 200));
    const { tab, find } = mount(vi.fn());
    tab.show!();
    step(16); // first frame draws
    step(16); // 16 ms later: below the 33 ms interval
    step(20);
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    expect(find('view-capture').hidden).toBe(true);
    expect(find('view-source').textContent).toContain('Sampling the canvas');
    tab.hide!();
    expect(raf.cancel).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
  });

  it('offers a capture when no canvas covers the area, and samples it', async () => {
    const stop = vi.fn();
    const open = vi.fn().mockResolvedValue({ video: video(), stop });
    const { tab, find } = mount(open);
    tab.show!();
    step(16);
    expect(find('view-capture').hidden).toBe(false);
    find('view-capture').click();
    await flush();
    step(40);
    expect(ctx.drawImage).toHaveBeenLastCalledWith(
      expect.anything(),
      0,
      0,
      640,
      400,
      0,
      0,
      320,
      200,
    );
    expect(find('view-capture').hidden).toBe(true);
    tab.hide!();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('stops a capture that resolves after the tab was hidden', async () => {
    let resolve!: (capture: TabCapture) => void;
    const open = vi.fn(() => new Promise<TabCapture>((r) => (resolve = r)));
    const { tab, find } = mount(open);
    tab.show!();
    find('view-capture').click();
    expect(find<HTMLButtonElement>('view-capture').disabled).toBe(true);
    tab.hide!();
    const stop = vi.fn();
    resolve({ video: video(), stop });
    await flush();
    expect(stop).toHaveBeenCalledOnce();
    expect(find<HTMLButtonElement>('view-capture').disabled).toBe(false);
  });

  it('shows why a capture failed', async () => {
    const { tab, find } = mount(vi.fn().mockRejectedValue(new Error('denied')));
    tab.show!();
    find('view-capture').click();
    await flush();
    step(16);
    expect(find('view-source').textContent).toBe('Tab capture failed: denied');
    expect(find('view-capture').hidden).toBe(false);
  });

  it('falls back when the capture ends or stops delivering frames', async () => {
    let ended!: () => void;
    const stop = vi.fn();
    const open = vi.fn((onEnded: () => void) => {
      ended = onEnded;
      return Promise.resolve({ video: video(), stop });
    });
    const { tab, find } = mount(open);
    tab.show!();
    find('view-capture').click();
    await flush();
    ended();
    expect(stop).toHaveBeenCalledOnce();
    step(16);
    expect(find('view-source').textContent).toBe('Tab capture ended.');

    find('view-capture').click();
    await flush();
    ctx.drawImage.mockImplementation(() => {
      throw new Error('lost');
    });
    step(40);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(find('view-source').textContent).toBe('Tab capture failed: lost');
    expect(find('view-capture').hidden).toBe(false);
  });
});
