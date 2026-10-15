import { logError } from './log';

/** Errors logged per loop; later ones are dropped, so a failing callback cannot flood the log. */
const MAX_ERRORS = 3;

/**
 * Calls `callback` on every animation frame for the page's lifetime, or every 50 ms without
 * requestAnimationFrame. Its errors are logged as `<section>-error`, the first few only.
 */
export function everyFrame(section: string, callback: () => void): void {
  let errors = 0;
  const tick = () => {
    try {
      callback();
    } catch (error) {
      if (errors++ < MAX_ERRORS) logError(section, error);
    }
  };
  if (typeof requestAnimationFrame !== 'function') {
    setInterval(tick, 50);
    return;
  }
  const frame = () => {
    tick();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
