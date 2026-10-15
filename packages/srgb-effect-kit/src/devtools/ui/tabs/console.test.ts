// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installConsoleCounter, type ConsoleCounter } from '../../consoleCounter';
import type { DevtoolsContext } from '../../context';
import { createConsoleTab } from './console';

let counter: ConsoleCounter;
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  counter = installConsoleCounter(window);
});
afterEach(() => {
  counter.restore();
  vi.restoreAllMocks();
});

describe('Console tab', () => {
  it('shows counts per method, batched per frame, and resets them', () => {
    const frames: FrameRequestCallback[] = [];
    const raf = { request: (cb: FrameRequestCallback) => frames.push(cb), cancel: vi.fn() };
    const tab = createConsoleTab({ consoleCounter: counter, raf } as unknown as DevtoolsContext);
    const count = (key: string) =>
      tab.element.querySelector(`[data-srgb-console="${key}"]`)!.textContent;
    const flush = () => frames.splice(0).forEach((frame) => frame(0));

    console.warn('careful');
    window.dispatchEvent(new Event('error'));
    expect(count('warn')).toBe('0');
    flush();
    expect(count('warn')).toBe('1');
    expect(count('uncaught')).toBe('1');
    expect(count('log')).toBe('0');

    tab.element.querySelector<HTMLButtonElement>('[data-srgb-devtools="console-reset"]')!.click();
    flush();
    expect(count('warn')).toBe('0');
  });
});
