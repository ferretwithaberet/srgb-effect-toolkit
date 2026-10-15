// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installConsoleCounter, type ConsoleCounter } from './consoleCounter';

let counter: ConsoleCounter;
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  for (const method of ['log', 'info', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation(() => {});
  }
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  counter = installConsoleCounter(window);
});
afterEach(() => {
  counter.restore();
  vi.restoreAllMocks();
});

describe('installConsoleCounter', () => {
  it('counts each method and still forwards the call', () => {
    console.log('a');
    console.log('b');
    console.warn('c');
    console.error('d');
    console.info('e');
    console.debug('f');
    expect(counter.counts).toMatchObject({ log: 2, warn: 1, error: 1, info: 1, debug: 1 });
    expect(counter.total).toBe(6);
    expect(warn).toHaveBeenCalledWith('c');
  });

  it("ignores Vite's own messages", () => {
    console.debug('[vite] connecting...');
    console.error('[vite] server connection lost');
    expect(counter.total).toBe(0);
  });

  it('counts uncaught errors and unhandled rejections', () => {
    window.dispatchEvent(new Event('error'));
    window.dispatchEvent(new Event('unhandledrejection'));
    expect(counter.counts.uncaught).toBe(2);
  });

  it('notifies subscribers, resets and restores', () => {
    const listener = vi.fn();
    counter.subscribe(listener);
    console.log('x');
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ log: 1 }));
    counter.reset();
    expect(counter.total).toBe(0);
    counter.restore();
    console.log('y');
    window.dispatchEvent(new Event('error'));
    expect(counter.total).toBe(0);
  });
});
