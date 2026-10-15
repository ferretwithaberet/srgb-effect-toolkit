import type { DevtoolsWindow } from './context';
import { reportError } from './lifecycle';

/** Console methods whose calls are counted. */
export const COUNTED_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;
export type CountedMethod = (typeof COUNTED_METHODS)[number];

/** Calls per console method, plus uncaught errors and unhandled rejections. */
export type ConsoleCounts = Record<CountedMethod | 'uncaught', number>;

/** Counts console output, since SignalRGB requires a clean console. */
export interface ConsoleCounter {
  readonly counts: Readonly<ConsoleCounts>;
  readonly total: number;
  reset(): void;
  subscribe(listener: (counts: Readonly<ConsoleCounts>) => void): () => void;
  /** Puts the original console methods back and stops listening for errors. */
  restore(): void;
}

const zero = (): ConsoleCounts => ({ log: 0, info: 0, warn: 0, error: 0, debug: 0, uncaught: 0 });

/** Vite's client logs through the console too; those messages start with `[vite]`. */
const isViteMessage = (args: unknown[]) =>
  typeof args[0] === 'string' && args[0].startsWith('[vite]');

/**
 * Wraps the page's console methods to count calls (still forwarding them) and listens for uncaught
 * errors and unhandled rejections. Messages from Vite's client are not counted.
 */
export function installConsoleCounter(win: DevtoolsWindow): ConsoleCounter {
  const counts = zero();
  const listeners = new Set<(counts: Readonly<ConsoleCounts>) => void>();
  let notifying = false;
  const notify = () => {
    notifying = true;
    try {
      for (const listener of listeners) {
        try {
          listener(counts);
        } catch (error) {
          reportError(win, error);
        }
      }
    } finally {
      notifying = false;
    }
  };
  const count = (key: keyof ConsoleCounts) => {
    counts[key] += 1;
    notify();
  };

  const console = win.console;
  const originals = new Map<CountedMethod, (...args: unknown[]) => void>();
  for (const method of COUNTED_METHODS) {
    const original = console[method] as (...args: unknown[]) => void;
    originals.set(method, original);
    console[method] = (...args: unknown[]) => {
      original.apply(console, args);
      // Output from inside a listener is forwarded but not counted, so a logging listener can't recurse.
      if (!notifying && !isViteMessage(args)) count(method);
    };
  }
  const onError = () => count('uncaught');
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onError);

  return {
    counts,
    get total() {
      return Object.values(counts).reduce((sum, value) => sum + value, 0);
    },
    reset() {
      Object.assign(counts, zero());
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore() {
      for (const [method, original] of originals) console[method] = original;
      win.removeEventListener('error', onError);
      win.removeEventListener('unhandledrejection', onError);
    },
  };
}
