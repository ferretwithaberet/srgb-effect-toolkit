// `engine` over time: its own and prototype names (host objects hide methods there), and the
// methods QtWebEngine showed (getNowPlaying, getSensorValue) called for real.
import { describe } from '../describe';
import { attempt, ctorName, logError, logJson, logSection, Raw, sections, serialize } from '../log';
import { now, readGlobal } from '../state';
import { withTimeout } from '../timeout';
import { getEngine } from './engine';

const CALL_TIMEOUT_MS = 3000;
const SUBOBJECTS = ['audio', 'zone', 'vision'];

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Each name in `names` with its `typeof`, read through `object` so getters get its `this`. */
function typesOf(object: object, names: readonly string[]): Record<string, string> {
  const types: Record<string, string> = {};
  for (const name of names) {
    try {
      types[name] = typeof (object as Record<string, unknown>)[name];
    } catch (error) {
      types[name] = `throws: ${message(error)}`;
    }
  }
  return types;
}

function ownNames(object: object): string[] {
  try {
    return Object.getOwnPropertyNames(object);
  } catch {
    return [];
  }
}

/** Own names and the prototype's own names, non-enumerable included, each with its `typeof`. */
function keysWithTypes(value: unknown) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return { typeof: typeof value };
  }
  const object = value as object;
  let proto: unknown;
  try {
    const p = Object.getPrototypeOf(object) as object | null;
    if (p === null) proto = null;
    else if (p === Object.prototype) proto = 'Object.prototype';
    else if (p === Function.prototype) proto = 'Function.prototype';
    else proto = { ctor: ctorName(p), names: typesOf(object, ownNames(p)) };
  } catch (error) {
    proto = { throws: message(error) };
  }
  return {
    typeof: typeof value,
    ctor: ctorName(object),
    own: typesOf(object, ownNames(object)),
    proto,
  };
}

/** `engine`, and each of audio, zone and vision that exists, as names with types. */
export function collectEngineKeys(at: string) {
  const engine = readGlobal('engine');
  const result: Record<string, unknown> = { at, t: now(), engine: keysWithTypes(engine) };
  const missing: string[] = [];
  const holder = getEngine();
  for (const name of SUBOBJECTS) {
    const child = holder ? attempt(() => holder[name]) : undefined;
    if (child === undefined) missing.push(name);
    else result[name] = keysWithTypes(child);
  }
  result.missing = missing;
  return result;
}

/** Logs `[probe] engine-keys`, kept for the REPORT as `engine-keys@<at>`. */
export function logEngineKeys(at: string): void {
  try {
    const json = serialize(collectEngineKeys(at));
    sections[`engine-keys@${at}`] = json;
    logJson('engine-keys', json);
  } catch (error) {
    logError('engine-keys', error);
  }
}

const isThenable = (value: unknown): value is PromiseLike<unknown> => {
  try {
    return (
      value !== null &&
      (typeof value === 'object' || typeof value === 'function') &&
      typeof (value as { then?: unknown }).then === 'function'
    );
  } catch {
    return false;
  }
};

const outcome = (value: unknown) => ({
  resultTypeof: typeof value,
  result: value,
  shape: new Raw(describe(value)),
});

/**
 * Calls `engine[method](...args)` and resolves to what happened: not a function, threw, returned
 * a value, or returned a promise that resolved, rejected or timed out after 3 s. Never rejects.
 */
function callEngine(method: string, args: unknown[]): Promise<Record<string, unknown>> {
  const engine = getEngine();
  const fn = engine ? attempt(() => engine[method]) : undefined;
  const base = { method, args, typeof: typeof fn };
  if (typeof fn !== 'function') return Promise.resolve({ ...base, called: false });
  const start = now();
  let result: unknown;
  try {
    result = (fn as (...a: unknown[]) => unknown).apply(engine, args);
  } catch (error) {
    return Promise.resolve({ ...base, called: true, threw: true, error });
  }
  if (!isThenable(result)) {
    return Promise.resolve({ ...base, called: true, promise: false, ...outcome(result) });
  }
  return withTimeout(Promise.resolve(result), CALL_TIMEOUT_MS, method).then(
    (value) => ({ ...base, called: true, promise: true, ms: now() - start, ...outcome(value) }),
    (error: unknown) => ({ ...base, called: true, promise: true, ms: now() - start, error }),
  );
}

/** Logs `[probe] now-playing` with what `engine.getNowPlaying()` gave back. */
export function logNowPlaying(): void {
  const t = now();
  callEngine('getNowPlaying', []).then(
    (call) => logSection('now-playing', { t, ...call }),
    (error: unknown) => logError('now-playing', error),
  );
}

/** The argument a sensor entry most likely stands for: itself, or its name or id. */
function sensorKey(entry: unknown): unknown {
  if (entry === null || typeof entry !== 'object') return entry;
  const record = entry as Record<string, unknown>;
  const name = attempt(() => record.name);
  if (typeof name === 'string' || typeof name === 'number') return name;
  const id = attempt(() => record.id);
  if (typeof id === 'string' || typeof id === 'number') return id;
  return entry;
}

/**
 * Logs `[probe] sensors`: `engine.sensors` and a `getSensorValue` call, with the first sensor's
 * name or id when there is one, or no arguments when the list is empty.
 */
export function logSensors(): void {
  const t = now();
  const engine = getEngine();
  const sensors = engine ? attempt(() => engine.sensors) : undefined;
  let length: number | null = null;
  try {
    const value = (sensors as { length?: unknown } | null | undefined)?.length;
    if (typeof value === 'number') length = value;
  } catch {
    // Not array-like.
  }
  const list = sensors as ArrayLike<unknown>;
  const args = length !== null && length > 0 ? [sensorKey(list[0])] : [];
  const info = {
    t,
    typeof: typeof sensors,
    isArray: Array.isArray(sensors),
    length,
    sample: length !== null ? Array.prototype.slice.call(list, 0, 16) : sensors,
    shape: new Raw(describe(sensors)),
  };
  callEngine('getSensorValue', args).then(
    (call) => logSection('sensors', { ...info, getSensorValue: call }),
    (error: unknown) => logError('sensors', error),
  );
}
