// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioController, AudioMode } from '../../audioController';
import type { DevtoolsContext } from '../../context';
import { createEngineMock } from '../../engine';
import { createAudioTab, formatLevel } from './audio';

const fakeAudio = () => {
  const listeners = new Set<() => void>();
  const state: { mode: AudioMode; error: string | undefined } = {
    mode: 'silent',
    error: undefined,
  };
  const controller: AudioController = {
    get mode() {
      return state.mode;
    },
    get error() {
      return state.error;
    },
    setMode: vi.fn(async (mode: AudioMode) => {
      state.mode = mode;
      for (const listener of listeners) listener();
    }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { controller, state, notify: () => listeners.forEach((listener) => listener()) };
};

const mount = () => {
  const audio = fakeAudio();
  const engine = createEngineMock();
  const frames: FrameRequestCallback[] = [];
  const raf = { request: vi.fn((cb: FrameRequestCallback) => frames.push(cb)), cancel: vi.fn() };
  const tab = createAudioTab({
    audio: audio.controller,
    engine,
    raf,
  } as unknown as DevtoolsContext);
  const button = (mode: AudioMode) =>
    tab.element.querySelector<HTMLButtonElement>(`[data-srgb-audio-mode="${mode}"]`)!;
  const text = (name: string) =>
    tab.element.querySelector(`[data-srgb-devtools="${name}"]`)!.textContent;
  return { tab, audio, engine, raf, frames, button, text };
};

beforeEach(() => {
  // jsdom has no canvas implementation; the tab must cope with a null context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('Audio tab', () => {
  it('shows one button per mode and marks the active one', async () => {
    const { button, audio } = mount();
    expect(button('silent').getAttribute('aria-pressed')).toBe('true');
    button('random').click();
    expect(audio.controller.setMode).toHaveBeenCalledWith('random');
    await Promise.resolve();
    expect(button('random').getAttribute('aria-pressed')).toBe('true');
    expect(button('silent').getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the capture error', () => {
    const { tab, audio } = mount();
    audio.state.error = 'No audio was shared.';
    audio.notify();
    const error = tab.element.querySelector<HTMLElement>('[data-srgb-devtools="audio-error"]')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('No audio was shared.');
  });

  it('refreshes the readouts every frame only while shown', () => {
    const { tab, engine, raf, frames, text } = mount();
    expect(raf.request).not.toHaveBeenCalled();
    engine.audio.level = -12.34;
    engine.audio.width = 0.5;
    tab.show!();
    expect(text('audio-level')).toBe('-12.3 dB');
    expect(text('audio-width')).toBe('0.50');
    expect(frames).toHaveLength(1);
    tab.hide!();
    expect(raf.cancel).toHaveBeenCalledOnce();
  });

  it('formats levels in dB', () => {
    expect(formatLevel(-100)).toBe('-100.0 dB');
    expect(formatLevel(0)).toBe('0.0 dB');
  });
});
