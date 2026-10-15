import type { Json } from './log';

/** Mutable probe state shared by the collectors, the REPORT line and the canvas status. */
export const state = {
  /** `performance.now()` when main.ts started. */
  startedAt: 0,
  domContentLoaded: false,
  load: false,
  /** Every `on<Prop>Changed` call, as logged. */
  changed: [] as Json[],
  /** Every `onCanvasApiEvent` call, as logged. */
  canvasEvents: [] as Json[],
  /** rAF rate measured by the timing collector, once known. */
  hz: null as number | null,
  /** `performance.now()` of the last REPORT line. */
  reportAt: null as number | null,
};

/** Milliseconds since page navigation started, or NaN without `performance`. */
export const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : NaN;

/** A value as `window` sees it, by name. */
export const readGlobal = (name: string): unknown =>
  (window as unknown as Record<string, unknown>)[name];
