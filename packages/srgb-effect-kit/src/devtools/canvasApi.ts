import type { CanvasApiEvent } from '../runtime/globals';
import type { DevtoolsWindow } from './context';
import { callGlobal } from './lifecycle';

/** Where a canvas API event came from: the drawer's form or `POST /canvas/event` on the dev server. */
export type CanvasEventSource = 'drawer' | 'http';

/** One dispatched event, as listed in the Canvas API tab. */
export interface CanvasEventRecord extends CanvasApiEvent {
  source: CanvasEventSource;
  /** Whether `window.onCanvasApiEvent` was a function when the event arrived. */
  handled: boolean;
  /** `Date.now()` at dispatch. */
  time: number;
}

/** Number of events the history keeps. */
export const CANVAS_HISTORY_LIMIT = 20;

/** Validates a WebSocket payload: an object with string `sender` and `event`. */
export function toCanvasApiEvent(data: unknown): CanvasApiEvent | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const { sender, event } = data as Record<string, unknown>;
  return typeof sender === 'string' && typeof event === 'string' ? { sender, event } : undefined;
}

/** Delivers canvas API events to the effect and remembers the latest ones. */
export interface CanvasApiController {
  /** Newest first, at most `CANVAS_HISTORY_LIMIT` entries. */
  readonly history: readonly CanvasEventRecord[];
  /** Calls `window.onCanvasApiEvent({ sender, event })`. Returns whether a handler existed. */
  dispatch(event: CanvasApiEvent, source: CanvasEventSource): boolean;
  subscribe(listener: (history: readonly CanvasEventRecord[]) => void): () => void;
}

export function createCanvasApi(
  win: DevtoolsWindow,
  now: () => number = () => Date.now(),
): CanvasApiController {
  let history: CanvasEventRecord[] = [];
  const listeners = new Set<(history: readonly CanvasEventRecord[]) => void>();
  return {
    get history() {
      return history;
    },
    dispatch({ sender, event }, source) {
      // A fresh object per call, like a real request; the handler may keep or mutate it.
      const handled = callGlobal(win, 'onCanvasApiEvent', { sender, event });
      history = [{ sender, event, source, handled, time: now() }, ...history].slice(
        0,
        CANVAS_HISTORY_LIMIT,
      );
      for (const listener of listeners) listener(history);
      return handled;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
