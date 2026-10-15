// Console output. Every line is `[probe] <section> <json>` on one line, and nothing here may throw:
// the probe's whole value is that it keeps reporting whatever the engine does.

const MAX_DEPTH = 4;
/** Arrays longer than this are logged as their length plus a sample. */
const LARGE_ARRAY = 64;
const SAMPLE = 16;

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

/** Already-serialized data that `serialize` passes through untouched (no second depth limit). */
export class Raw {
  readonly json: Json;
  constructor(json: Json) {
    this.json = json;
  }
}

const errorMessage = (error: unknown): string => {
  try {
    return error instanceof Error ? error.message : String(error);
  } catch {
    return '[unprintable error]';
  }
};

/** Name of a value's constructor, or null when it has none (or reading it throws). */
export function ctorName(value: unknown): string | null {
  try {
    if (value === null || value === undefined) return null;
    const ctor = (value as { constructor?: { name?: unknown } }).constructor;
    return ctor && typeof ctor.name === 'string' ? ctor.name : null;
  } catch {
    return '[throws]';
  }
}

const isTypedArray = (value: object): value is ArrayLike<number> =>
  typeof ArrayBuffer !== 'undefined' &&
  typeof ArrayBuffer.isView === 'function' &&
  ArrayBuffer.isView(value) &&
  !(typeof DataView !== 'undefined' && value instanceof DataView);

const number = (value: number): Json => (Number.isFinite(value) ? value : String(value));

/** Turns any value into JSON-safe data: no cycles, bounded depth and size, no throwing getters. */
export function serialize(value: unknown, depth = 0, ancestors: object[] = []): Json {
  try {
    if (value === null) return null;
    switch (typeof value) {
      case 'undefined':
        return '[undefined]';
      case 'boolean':
      case 'string':
        return value;
      case 'number':
        return number(value);
      case 'bigint':
        return `${String(value)}n`;
      case 'symbol':
        return value.toString();
      case 'function':
        return 'function';
    }
    const object = value as object;
    if (object instanceof Raw) return object.json;
    if (ancestors.indexOf(object) !== -1) return '[cycle]';
    if (typeof window !== 'undefined' && object === window) return '[window]';
    if (typeof Node !== 'undefined' && object instanceof Node) {
      return Object.prototype.toString.call(object);
    }
    if (object instanceof Error) {
      return { name: object.name, message: object.message, stack: String(object.stack) };
    }
    if (isTypedArray(object)) {
      const sample: Json[] = [];
      for (let i = 0; i < Math.min(SAMPLE, object.length); i++) sample.push(number(object[i]!));
      return { type: ctorName(object), length: object.length, sample };
    }
    if (depth >= MAX_DEPTH) return '[depth]';
    const inner = ancestors.concat([object]);
    if (Array.isArray(object)) {
      const items: Json[] = [];
      const count = object.length > LARGE_ARRAY ? SAMPLE : object.length;
      for (let i = 0; i < count; i++) items.push(serialize(object[i], depth + 1, inner));
      return object.length > LARGE_ARRAY
        ? { type: 'Array', length: object.length, sample: items }
        : items;
    }
    const result: { [key: string]: Json } = {};
    for (const key of Object.keys(object)) {
      let child: unknown;
      try {
        child = (object as Record<string, unknown>)[key];
      } catch (error) {
        result[key] = `[throws: ${errorMessage(error)}]`;
        continue;
      }
      result[key] = serialize(child, depth + 1, inner);
    }
    return result;
  } catch (error) {
    return `[unserializable: ${errorMessage(error)}]`;
  }
}

/** Every section logged so far, by name, for the REPORT line. */
export const sections: Record<string, Json> = {};

/**
 * Logs one `[probe] <section> <json>` line from data that is already serialized, so nesting it
 * (as the REPORT line does) does not apply the depth limit twice. Never throws.
 */
export function logJson(section: string, json: Json): void {
  let line: string;
  try {
    line = `[probe] ${section} ${JSON.stringify(json)}`;
  } catch (error) {
    line = `[probe] ${section} ${JSON.stringify({ unserializable: errorMessage(error) })}`;
  }
  try {
    console.log(line);
  } catch {
    // Nowhere left to report to.
  }
}

/** Logs one `[probe] <section> <json>` line. Never throws. */
export function log(section: string, data: unknown): void {
  logJson(section, serialize(data));
}

/** Logs an error as `[probe] <section>-error {message, stack}`. */
export function logError(section: string, error: unknown): void {
  let stack: string | null = null;
  try {
    stack = error instanceof Error && error.stack ? String(error.stack) : null;
  } catch {
    // Keep stack null.
  }
  log(`${section}-error`, { message: errorMessage(error), stack });
}

/** Logs a section and keeps it for the REPORT line. */
export function logSection(section: string, data: unknown): void {
  const json = serialize(data);
  sections[section] = json;
  logJson(section, json);
}

/** Runs a synchronous collector and logs its result, or its error, as the section. */
export function run(section: string, collect: () => unknown): void {
  try {
    logSection(section, collect());
  } catch (error) {
    logError(section, error);
  }
}

/** Runs a callback, logging any error as `<section>-error`. For timers and event handlers. */
export function guard(section: string, callback: () => void): void {
  try {
    callback();
  } catch (error) {
    logError(section, error);
  }
}

/** Evaluates `read`, returning its value or `{ throws: message }`. */
export function attempt<T>(read: () => T): T | { throws: string } {
  try {
    return read();
  } catch (error) {
    return { throws: errorMessage(error) };
  }
}
