import { handlerName, type PropertyDef } from '../shared';
import { globalsOf, type DevtoolsWindow } from './context';
import { callGlobal, reportError } from './lifecycle';
import { isRecord, type DevtoolsStorage } from './storage';

/**
 * A property global's value in SignalRGB's raw format: a number for `number` and `hue`, `'0'`/`'1'`
 * for `boolean`, `#rrggbb` for `color`, and the string itself for `textfield` and `list`.
 */
export type RawValue = number | string;

type RangeProperty = Extract<PropertyDef, { type: 'number' | 'hue' }>;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const STORAGE_KEY = 'properties';

/** `[min, max]` of a number or hue property, with the hue defaults applied. */
export const propertyRange = (p: RangeProperty): [min: number, max: number] =>
  p.type === 'number' ? [p.min, p.max] : [p.min ?? 0, p.max ?? 360];

/** The property's default in raw format. */
export const defaultRaw = (p: PropertyDef): RawValue =>
  p.type === 'boolean' ? (p.default ? '1' : '0') : p.default;

/**
 * Converts `value` into a valid raw value for `p`, or returns undefined when it cannot be one.
 * Numbers (and numeric strings) are rounded to whole numbers and clamped to the property's range;
 * booleans accept `true`/`false`, `1`/`0` and `'1'`/`'0'`; colors must be `#rrggbb`; list values
 * must be one of `values`.
 */
export function coerceRaw(p: PropertyDef, value: unknown): RawValue | undefined {
  switch (p.type) {
    case 'number':
    case 'hue': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || !Number.isFinite(n)) return undefined;
      const [min, max] = propertyRange(p);
      return Math.min(max, Math.max(min, Math.round(n)));
    }
    case 'boolean':
      if (value === true || value === 1 || value === '1') return '1';
      if (value === false || value === 0 || value === '0') return '0';
      return undefined;
    case 'color':
      return typeof value === 'string' && HEX_COLOR.test(value) ? value : undefined;
    case 'textfield':
      return typeof value === 'string' ? value : undefined;
    case 'list':
      return typeof value === 'string' && p.values.includes(value) ? value : undefined;
  }
}

/** Owns the property globals: their values, persistence and change handlers. */
export interface PropertyController {
  /** The manifest's properties, in UI order. */
  readonly definitions: readonly PropertyDef[];
  /** Current raw value, or undefined for an unknown name. */
  get(name: string): RawValue | undefined;
  /**
   * Coerces `value` (see `coerceRaw`), sets the global, persists, notifies subscribers, then calls
   * `window.on<Prop>Changed()` with no arguments. Returns false and changes nothing for an unknown
   * name or an invalid value. Setting the current value again does nothing.
   */
  set(name: string, value: unknown): boolean;
  /** Restores every default in property order, calling handlers only for values that changed. */
  reset(): void;
  /** Calls every `on<Prop>Changed` in property order: SignalRGB's load-time calls. */
  fireAll(): void;
  /** Called after each change with the property name and its new raw value. */
  subscribe(listener: (name: string, value: RawValue) => void): () => void;
}

/**
 * Sets every property global from its persisted value, falling back to the default when nothing
 * valid is stored (for example after a property was renamed or its `values` changed).
 */
export function createPropertyController(
  definitions: readonly PropertyDef[],
  storage: DevtoolsStorage,
  win: DevtoolsWindow,
): PropertyController {
  const globals = globalsOf(win);
  const byName = new Map(definitions.map((p) => [p.property, p]));
  const values = new Map<string, RawValue>();
  const listeners = new Set<(name: string, value: RawValue) => void>();

  const persisted = storage.read(STORAGE_KEY, isRecord) ?? {};
  for (const p of definitions) {
    const value = coerceRaw(p, persisted[p.property]) ?? defaultRaw(p);
    values.set(p.property, value);
    globals[p.property] = value;
  }

  const apply = (p: PropertyDef, value: RawValue) => {
    values.set(p.property, value);
    globals[p.property] = value;
    storage.write(STORAGE_KEY, Object.fromEntries(values));
    for (const listener of listeners) {
      try {
        listener(p.property, value);
      } catch (error) {
        reportError(win, error);
      }
    }
    callGlobal(win, handlerName(p.property));
  };

  return {
    definitions,
    get: (name) => values.get(name),
    set(name, value) {
      const p = byName.get(name);
      if (!p) return false;
      const raw = coerceRaw(p, value);
      if (raw === undefined) return false;
      if (raw !== values.get(name)) apply(p, raw);
      return true;
    },
    reset() {
      for (const p of definitions) {
        const value = defaultRaw(p);
        if (value !== values.get(p.property)) apply(p, value);
      }
    },
    fireAll() {
      for (const p of definitions) callGlobal(win, handlerName(p.property));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
