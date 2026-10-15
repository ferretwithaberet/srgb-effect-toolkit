import { ctorName, serialize, type Json } from './log';

const MAX_DEPTH = 4;
const SAMPLE = 16;

/** Own names plus inherited enumerable keys: host objects may expose fields on a prototype. */
export function keysOf(value: object): string[] {
  const keys: string[] = [];
  try {
    for (const key of Object.getOwnPropertyNames(value)) keys.push(key);
  } catch {
    // Keep what we have.
  }
  try {
    for (const key in value) if (keys.indexOf(key) === -1) keys.push(key);
  } catch {
    // Keep what we have.
  }
  return keys;
}

const isArrayLike = (value: object): value is ArrayLike<unknown> => {
  try {
    return typeof (value as { length?: unknown }).length === 'number';
  } catch {
    return false;
  }
};

/**
 * Describes a value's shape: `typeof`, constructor, `Array.isArray`, length and a sample for
 * array-likes, and the same for each key of plain objects, down to depth 4.
 */
export function describe(value: unknown, depth = 0, ancestors: object[] = []): Json {
  const info: { [key: string]: Json } = { typeof: typeof value };
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    info.value = serialize(value);
    return info;
  }
  const object = value as object;
  info.ctor = ctorName(object);
  if (ancestors.indexOf(object) !== -1) {
    info.cycle = true;
    return info;
  }
  info.isArray = Array.isArray(object);
  if (isArrayLike(object) && typeof value !== 'function') {
    const list = object as ArrayLike<unknown>;
    info.length = list.length;
    const sample: Json[] = [];
    for (let i = 0; i < Math.min(SAMPLE, list.length); i++) sample.push(serialize(list[i], 3));
    info.sample = sample;
    return info;
  }
  if (typeof value === 'function') return info;
  try {
    const proto = Object.getPrototypeOf(object) as unknown;
    info.proto = proto === null ? null : ctorName(proto);
  } catch {
    info.proto = '[throws]';
  }
  if (depth >= MAX_DEPTH) {
    info.keys = keysOf(object);
    return info;
  }
  const children: { [key: string]: Json } = {};
  for (const key of keysOf(object)) {
    try {
      children[key] = describe(
        (object as Record<string, unknown>)[key],
        depth + 1,
        ancestors.concat([object]),
      );
    } catch (error) {
      children[key] = { throws: error instanceof Error ? error.message : String(error) };
    }
  }
  info.children = children;
  return info;
}
