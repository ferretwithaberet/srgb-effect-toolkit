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
import { overrideUserAgent } from './renderer';

const globals = window as unknown as Record<string, unknown>;
const userAgent = navigator.userAgent;
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
  // Unwrap the console before restoring spies, so the spies' originals come back last.
  for (const context of started.splice(0)) context.consoleCounter.restore();
  vi.restoreAllMocks();
  overrideUserAgent(navigator, userAgent);
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

  it('relays canvas events from the dev server to onCanvasApiEvent', () => {
    const listeners = new Map<string, (data: unknown) => void>();
    start(CONFIG, { hot: { on: (event, listener) => listeners.set(event, listener) } });
    const handler = vi.fn();
    window.onCanvasApiEvent = handler;
    const relay = listeners.get('srgb-effect:canvas-event')!;
    relay({ sender: 'game', event: 'hit' });
    relay({ nonsense: true });
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ sender: 'game', event: 'hit' });
  });

  it('applies the persisted renderer before effect code runs', () => {
    localStorage.setItem(
      'srgb-effect-kit:Devtools Test:renderer',
      JSON.stringify({ renderer: 'qtwebengine', fps: 30 }),
    );
    const context = start();
    expect(navigator.userAgent).toMatch(/QtWebEngine\//);
    expect(context.renderer.settings).toEqual({ renderer: 'qtwebengine', fps: 30 });
  });

  it('counts console output from the start', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const context = start();
    console.log('effect output');
    expect(context.consoleCounter.counts.log).toBe(1);
  });

  it('mounts the drawer once the DOM is ready', () => {
    setReadyState('interactive');
    start();
    expect(document.querySelector('srgb-effect-devtools')).toBeNull();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    const host = document.querySelector('srgb-effect-devtools');
    expect(host).not.toBeNull();
    expect(host!.shadowRoot).toBeInstanceOf(ShadowRoot);
  });

  it('returns the existing context when started twice', () => {
    const first = start();
    const second = start({ ...CONFIG, manifest: { title: 'Other' } });
    expect(second).toBe(first);
    expect(first.config.manifest).toBe(MANIFEST);
  });
});
