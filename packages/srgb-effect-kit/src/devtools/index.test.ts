// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG,
  MANIFEST,
  resetDevtoolsWindow,
  restoreReadyState,
  setReadyState,
} from '../../test/helpers/devtools';
import type { DevtoolsConfig } from '../shared';
import { startDevtools, type DevtoolsContext, type StartOptions } from './index';

const globals = window as unknown as Record<string, unknown>;
const started: DevtoolsContext[] = [];
const start = (config: DevtoolsConfig = CONFIG, options?: StartOptions) => {
  const context = startDevtools(config, options);
  started.push(context);
  return context;
};

beforeEach(() => {
  vi.useFakeTimers();
  resetDevtoolsWindow();
  vi.stubGlobal('reportError', vi.fn());
});
afterEach(() => {
  started.length = 0;
  restoreReadyState();
  vi.unstubAllGlobals();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('startDevtools', () => {
  it('defines property globals, handler globals and the engine synchronously', () => {
    setReadyState('interactive');
    start();
    expect(globals.speed).toBe(50);
    expect(globals.rainbow).toBe('1');
    for (const name of ['onSpeedChanged', 'onModeChanged', 'onCanvasApiEvent']) {
      expect(name in window).toBe(true);
      expect(globals[name]).toBeUndefined();
    }
    expect(window.engine.audio.level).toBe(-100);
    expect(window.engine.audio.freq).toHaveLength(200);
    expect(window.engine.zone.hue).toHaveLength(560);
    expect({ ...window.engine.vision }).toEqual({ health: 0, mana: 0, victory: 0, score: -1 });
  });

  it('keeps handlers that already exist', () => {
    const existing = () => {};
    globals.onSpeedChanged = existing;
    start();
    expect(globals.onSpeedChanged).toBe(existing);
  });

  it('fires handlers in property order on DOMContentLoaded, after effect code assigned them', () => {
    setReadyState('interactive');
    start();
    // Effect code runs after the devtools module and assigns its handlers.
    const fired: string[] = [];
    globals.onModeChanged = () => fired.push('mode');
    globals.onSpeedChanged = () => fired.push(`speed:${String(globals.speed)}`);
    expect(fired).toEqual([]);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(fired).toEqual(['speed:50', 'mode']);
  });

  it('does not fire handlers when fireChangedOnLoad is false', () => {
    setReadyState('interactive');
    start({ ...CONFIG, fireChangedOnLoad: false });
    const handler = vi.fn();
    globals.onSpeedChanged = handler;
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(handler).not.toHaveBeenCalled();
  });

  it('fires on the next task when the document already finished loading', () => {
    start();
    const handler = vi.fn();
    globals.onSpeedChanged = handler;
    expect(handler).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('returns the existing context when started twice', () => {
    const first = start();
    const second = start({ ...CONFIG, manifest: { title: 'Other' } });
    expect(second).toBe(first);
    expect(first.config.manifest).toBe(MANIFEST);
  });
});
