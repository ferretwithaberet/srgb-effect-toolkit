// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreReadyState, setReadyState } from '../../test/helpers/devtools';
import { callGlobal, onDomReady, reportError } from './lifecycle';

const globals = window as unknown as Record<string, unknown>;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  delete globals.handler;
  restoreReadyState();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('onDomReady', () => {
  it('waits for DOMContentLoaded while the document is parsing', () => {
    setReadyState('interactive');
    const callback = vi.fn();
    onDomReady(window, callback);
    vi.runAllTimers();
    expect(callback).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(callback).toHaveBeenCalledOnce();
  });

  it('runs on the next task once the document is complete', () => {
    const callback = vi.fn();
    onDomReady(window, callback);
    expect(callback).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(callback).toHaveBeenCalledOnce();
  });
});

describe('callGlobal', () => {
  it('calls a global function with the given arguments and window as this', () => {
    const handler = vi.fn(function (this: unknown) {
      return this;
    });
    globals.handler = handler;
    expect(callGlobal(window, 'handler', 1, 'a')).toBe(true);
    expect(handler).toHaveBeenCalledWith(1, 'a');
    expect(handler.mock.results[0]?.value).toBe(window);
  });

  it('returns false when the global is not a function', () => {
    globals.handler = 'nope';
    expect(callGlobal(window, 'handler')).toBe(false);
    expect(callGlobal(window, 'missing')).toBe(false);
  });

  it('reports what the handler throws instead of rethrowing', () => {
    const report = vi.fn();
    vi.stubGlobal('reportError', report);
    const error = new Error('boom');
    globals.handler = () => {
      throw error;
    };
    expect(() => callGlobal(window, 'handler')).not.toThrow();
    expect(report).toHaveBeenCalledWith(error);
  });
});

describe('reportError', () => {
  it('falls back to rethrowing on a timer without window.reportError', () => {
    vi.stubGlobal('reportError', undefined);
    const error = new Error('later');
    reportError(window, error);
    expect(() => vi.runAllTimers()).toThrow(error);
  });
});
