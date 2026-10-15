// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG,
  resetDevtoolsWindow,
  restoreReadyState,
  setReadyState,
} from '../../test/helpers/devtools';
import { startDevtools } from './minimal';

const globals = window as unknown as Record<string, unknown>;
const userAgent = navigator.userAgent;

beforeEach(() => {
  vi.useFakeTimers();
  resetDevtoolsWindow();
  vi.stubGlobal('reportError', vi.fn());
});
afterEach(() => {
  restoreReadyState();
  vi.unstubAllGlobals();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('startDevtools (minimal)', () => {
  it('defines handler globals, default property globals and the engine', () => {
    setReadyState('interactive');
    startDevtools(CONFIG);
    expect([globals.speed, globals.rainbow, globals.tint, globals.mode]).toEqual([
      50,
      '1',
      '#009bde',
      'Wave',
    ]);
    expect('onSpeedChanged' in window && 'onCanvasApiEvent' in window).toBe(true);
    expect(window.engine.audio.level).toBe(-100);
    expect(window.engine.zone.hue).toHaveLength(560);
    expect({ ...window.engine.vision }).toEqual({ health: 0, mana: 0, victory: 0, score: -1 });
  });

  it('ignores and never writes persisted values', () => {
    localStorage.setItem(
      'srgb-effect-kit:Devtools Test:properties',
      JSON.stringify({ speed: 99, mode: 'Pulse' }),
    );
    const context = startDevtools(CONFIG);
    expect([globals.speed, globals.mode]).toEqual([50, 'Wave']);
    context.properties.set('speed', 10);
    expect(globals.speed).toBe(10);
    expect(JSON.parse(localStorage.getItem('srgb-effect-kit:Devtools Test:properties')!)).toEqual({
      speed: 99,
      mode: 'Pulse',
    });
  });

  it('fires handlers on DOMContentLoaded, per fireChangedOnLoad', () => {
    setReadyState('interactive');
    startDevtools(CONFIG);
    const handler = vi.fn();
    globals.onSpeedChanged = handler;
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(handler).toHaveBeenCalledOnce();

    resetDevtoolsWindow();
    startDevtools({ ...CONFIG, fireChangedOnLoad: false });
    const silent = vi.fn();
    globals.onSpeedChanged = silent;
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(silent).not.toHaveBeenCalled();
  });

  it('relays canvas events from the dev server', () => {
    const listeners = new Map<string, (data: unknown) => void>();
    startDevtools(CONFIG, { hot: { on: (event, listener) => listeners.set(event, listener) } });
    const handler = vi.fn();
    window.onCanvasApiEvent = handler;
    listeners.get('srgb-effect:canvas-event')!({ sender: 'game', event: 'hit' });
    expect(handler).toHaveBeenCalledWith({ sender: 'game', event: 'hit' });
  });

  it('shows nothing and simulates no renderer or console counter', () => {
    localStorage.setItem(
      'srgb-effect-kit:Devtools Test:renderer',
      JSON.stringify({ renderer: 'ultralight', fps: 30 }),
    );
    const raf = window.requestAnimationFrame;
    const log = console.log;
    setReadyState('interactive');
    startDevtools(CONFIG);
    document.dispatchEvent(new Event('DOMContentLoaded'));
    vi.runAllTimers();
    expect(document.querySelector('srgb-effect-devtools')).toBeNull();
    expect(navigator.userAgent).toBe(userAgent);
    expect(window.requestAnimationFrame).toBe(raf);
    expect(console.log).toBe(log);
  });

  it('returns the existing context when started twice', () => {
    const first = startDevtools(CONFIG);
    expect(startDevtools({ ...CONFIG, manifest: { title: 'Other' } })).toBe(first);
  });
});
