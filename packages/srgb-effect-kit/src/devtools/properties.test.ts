// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../test/helpers/devtools';
import type { PropertyDef } from '../shared';
import { coerceRaw, createPropertyController, defaultRaw } from './properties';
import { createStorage } from './storage';

const [speed, baseHue, rainbow, tint, text, mode] = MANIFEST.properties;
const globals = window as unknown as Record<string, unknown>;
const storage = () => createStorage(MANIFEST.title, () => localStorage);
const create = () => createPropertyController(MANIFEST.properties, storage(), window);

beforeEach(() => {
  resetDevtoolsWindow();
  vi.stubGlobal('reportError', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('raw formats', () => {
  it('converts defaults to SignalRGB raw format', () => {
    expect(MANIFEST.properties.map((p) => defaultRaw(p))).toEqual([
      50,
      120,
      '1',
      '#009bde',
      '',
      'Wave',
    ]);
    const off: PropertyDef = { property: 'off', type: 'boolean', label: 'Off', default: false };
    expect(defaultRaw(off)).toBe('0');
  });

  it('coerces numbers: rounds, clamps and parses numeric strings', () => {
    expect(coerceRaw(speed, 42.6)).toBe(43);
    expect(coerceRaw(speed, 250)).toBe(100);
    expect(coerceRaw(speed, '7')).toBe(7);
    expect(coerceRaw(speed, '')).toBeUndefined();
    expect(coerceRaw(speed, Number.NaN)).toBeUndefined();
    expect(coerceRaw(speed, '1')).toBe(1);
    expect(coerceRaw(baseHue, 400)).toBe(360);
    expect(coerceRaw(baseHue, -5)).toBe(0);
  });

  it('coerces booleans to "0"/"1"', () => {
    expect(coerceRaw(rainbow, true)).toBe('1');
    expect(coerceRaw(rainbow, 0)).toBe('0');
    expect(coerceRaw(rainbow, '1')).toBe('1');
    expect(coerceRaw(rainbow, 'true')).toBeUndefined();
  });

  it('accepts #rrggbb colors, any string for textfields and listed values for lists', () => {
    expect(coerceRaw(tint, '#FF0000')).toBe('#FF0000');
    expect(coerceRaw(tint, 'red')).toBeUndefined();
    expect(coerceRaw(tint, '#fff')).toBeUndefined();
    expect(coerceRaw(text, '')).toBe('');
    expect(coerceRaw(text, 5)).toBeUndefined();
    expect(coerceRaw(mode, 'Pulse')).toBe('Pulse');
    expect(coerceRaw(mode, 'Spiral')).toBeUndefined();
  });
});

describe('createPropertyController', () => {
  it('sets every global to its default in raw format', () => {
    create();
    expect(globals.speed).toBe(50);
    expect(globals.baseHue).toBe(120);
    expect(globals.rainbow).toBe('1');
    expect(globals.tint).toBe('#009bde');
    expect(globals.text).toBe('');
    expect(globals.mode).toBe('Wave');
  });

  it('restores persisted values and falls back to defaults for stale ones', () => {
    localStorage.setItem(
      'srgb-effect-kit:Devtools Test:properties',
      JSON.stringify({ speed: 80, mode: 'Removed', rainbow: true, tint: 7, renamed: 1 }),
    );
    create();
    expect(globals.speed).toBe(80);
    expect(globals.mode).toBe('Wave');
    expect(globals.rainbow).toBe('1');
    expect(globals.tint).toBe('#009bde');
    expect(globals.renamed).toBeUndefined();
  });

  it('ignores persisted data that is not an object', () => {
    localStorage.setItem('srgb-effect-kit:Devtools Test:properties', '[1,2]');
    create();
    expect(globals.speed).toBe(50);
  });

  it('sets the global before calling the handler with no arguments, and persists', () => {
    const properties = create();
    const seen: unknown[] = [];
    globals.onSpeedChanged = (...args: unknown[]) => seen.push(globals.speed, args.length);
    const listener = vi.fn();
    properties.subscribe(listener);

    expect(properties.set('speed', 75)).toBe(true);
    expect(seen).toEqual([75, 0]);
    expect(listener).toHaveBeenCalledWith('speed', 75);
    expect(properties.get('speed')).toBe(75);
    expect(JSON.parse(localStorage.getItem('srgb-effect-kit:Devtools Test:properties')!)).toEqual({
      speed: 75,
      baseHue: 120,
      rainbow: '1',
      tint: '#009bde',
      text: '',
      mode: 'Wave',
    });
  });

  it('rejects unknown names and invalid values, and skips unchanged values', () => {
    const properties = create();
    const handler = vi.fn();
    globals.onModeChanged = handler;
    expect(properties.set('nope', 1)).toBe(false);
    expect(properties.set('mode', 'Spiral')).toBe(false);
    expect(properties.set('mode', 'Wave')).toBe(true);
    expect(handler).not.toHaveBeenCalled();
    expect(globals.mode).toBe('Wave');
  });

  it('fires every handler in property order', () => {
    const properties = create();
    const order: string[] = [];
    for (const name of ['onModeChanged', 'onSpeedChanged', 'onTintChanged']) {
      globals[name] = () => order.push(name);
    }
    properties.fireAll();
    expect(order).toEqual(['onSpeedChanged', 'onTintChanged', 'onModeChanged']);
  });

  it('keeps firing when a handler throws, and reports the error', () => {
    const properties = create();
    const error = new Error('boom');
    globals.onSpeedChanged = () => {
      throw error;
    };
    const after = vi.fn();
    globals.onModeChanged = after;
    properties.fireAll();
    expect(after).toHaveBeenCalledOnce();
    expect(window.reportError).toHaveBeenCalledWith(error);
  });

  it('isolates a throwing subscriber: the handler and later subscribers still run', () => {
    const properties = create();
    const error = new Error('subscriber failed');
    const handler = vi.fn();
    globals.onSpeedChanged = handler;
    const later = vi.fn();
    properties.subscribe(() => {
      throw error;
    });
    properties.subscribe(later);
    expect(properties.set('speed', 3)).toBe(true);
    expect(later).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledOnce();
    expect(window.reportError).toHaveBeenCalledWith(error);
  });

  it('resets to defaults, firing only for values that changed', () => {
    const properties = create();
    properties.set('speed', 10);
    properties.set('text', 'hi');
    const fired: string[] = [];
    for (const name of ['onSpeedChanged', 'onTextChanged', 'onModeChanged']) {
      globals[name] = () => fired.push(name);
    }
    properties.reset();
    expect(fired).toEqual(['onSpeedChanged', 'onTextChanged']);
    expect(globals.speed).toBe(50);
    expect(globals.text).toBe('');
  });
});
