import { globalsOf, type DevtoolsWindow } from './context';

/**
 * Runs `callback` once every deferred script, including all module scripts, has run: on
 * `DOMContentLoaded`, or on the next task when the document already finished loading.
 */
export function onDomReady(win: DevtoolsWindow, callback: () => void): void {
  if (win.document.readyState === 'complete') {
    win.setTimeout(callback, 0);
    return;
  }
  win.document.addEventListener('DOMContentLoaded', () => callback(), { once: true });
}

/** Reports an error like an uncaught exception, without interrupting the caller. */
export function reportError(win: DevtoolsWindow, error: unknown): void {
  if (typeof win.reportError === 'function') {
    win.reportError(error);
    return;
  }
  win.setTimeout(() => {
    throw error;
  }, 0);
}

/**
 * Calls the global function `name` with `args`, the way SignalRGB calls handlers. Returns whether
 * the global was a function. What it throws is reported, not rethrown.
 */
export function callGlobal(win: DevtoolsWindow, name: string, ...args: unknown[]): boolean {
  const handler = globalsOf(win)[name];
  if (typeof handler !== 'function') return false;
  try {
    handler.apply(win, args);
  } catch (error) {
    reportError(win, error);
  }
  return true;
}
