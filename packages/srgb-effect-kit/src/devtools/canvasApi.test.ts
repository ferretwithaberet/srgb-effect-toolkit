// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDevtoolsWindow } from '../../test/helpers/devtools';
import { CANVAS_HISTORY_LIMIT, createCanvasApi, toCanvasApiEvent } from './canvasApi';

beforeEach(() => {
  resetDevtoolsWindow();
  vi.stubGlobal('reportError', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('toCanvasApiEvent', () => {
  it('accepts objects with string sender and event only', () => {
    expect(toCanvasApiEvent({ sender: 'a', event: 'b', extra: 1 })).toEqual({
      sender: 'a',
      event: 'b',
    });
    expect(toCanvasApiEvent({ sender: 'a' })).toBeUndefined();
    expect(toCanvasApiEvent({ sender: 1, event: 'b' })).toBeUndefined();
    expect(toCanvasApiEvent('a')).toBeUndefined();
    expect(toCanvasApiEvent(null)).toBeUndefined();
  });
});

describe('createCanvasApi', () => {
  it('calls onCanvasApiEvent with { sender, event } and records the event', () => {
    const api = createCanvasApi(window, () => 1000);
    const handler = vi.fn();
    window.onCanvasApiEvent = handler;
    const listener = vi.fn();
    api.subscribe(listener);

    expect(api.dispatch({ sender: 'game', event: 'hit' }, 'http')).toBe(true);
    expect(handler).toHaveBeenCalledWith({ sender: 'game', event: 'hit' });
    expect(api.history).toEqual([
      { sender: 'game', event: 'hit', source: 'http', handled: true, time: 1000 },
    ]);
    expect(listener).toHaveBeenCalledWith(api.history);
  });

  it('records unhandled events and reports handler errors', () => {
    const api = createCanvasApi(window);
    expect(api.dispatch({ sender: 's', event: 'e' }, 'drawer')).toBe(false);
    expect(api.history[0]?.handled).toBe(false);

    const error = new Error('handler failed');
    window.onCanvasApiEvent = () => {
      throw error;
    };
    expect(api.dispatch({ sender: 's', event: 'e' }, 'drawer')).toBe(true);
    expect(window.reportError).toHaveBeenCalledWith(error);
  });

  it('keeps the newest events first, up to the limit', () => {
    const api = createCanvasApi(window);
    for (let i = 0; i < CANVAS_HISTORY_LIMIT + 5; i += 1) {
      api.dispatch({ sender: 's', event: String(i) }, 'drawer');
    }
    expect(api.history).toHaveLength(CANVAS_HISTORY_LIMIT);
    expect(api.history[0]?.event).toBe(String(CANVAS_HISTORY_LIMIT + 4));
  });
});
