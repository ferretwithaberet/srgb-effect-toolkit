// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../../test/helpers/devtools';
import { installConsoleCounter, type ConsoleCounter } from '../consoleCounter';
import type { DevtoolsContext } from '../context';
import { createStorage } from '../storage';
import { mountUi } from './index';

let counter: ConsoleCounter;
beforeEach(() => {
  resetDevtoolsWindow();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  counter = installConsoleCounter(window);
});
afterEach(() => {
  counter.restore();
  vi.restoreAllMocks();
});

describe('mountUi', () => {
  it('shows the console count on the toggle badge', () => {
    const frames: FrameRequestCallback[] = [];
    console.error('before mount');
    const drawer = mountUi({
      win: window,
      storage: createStorage(MANIFEST.title, () => localStorage),
      consoleCounter: counter,
      raf: { request: (cb: FrameRequestCallback) => frames.push(cb), cancel: vi.fn() },
    } as unknown as DevtoolsContext);
    const badge = drawer.root.querySelector<HTMLElement>('[data-srgb-devtools="badge"]')!;
    expect(badge.textContent).toBe('1');
    console.error('after mount');
    frames.splice(0).forEach((frame) => frame(0));
    expect(badge.textContent).toBe('2');
  });
});
