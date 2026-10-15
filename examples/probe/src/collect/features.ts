// JavaScript level and web features. The syntax checks are strings compiled with new Function, so
// the build never transpiles them: each one reports what the engine itself parses and runs.
// Each group is logged as its own `features-<group>` line as soon as it completes; the REPORT gets
// them combined under `features`.
import { attempt, logError, logJson, sections, serialize, type Json } from '../log';

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Each body must return true. Ordered from ES2015 up. */
const SYNTAX: Record<string, string> = {
  arrowFunctions: 'var f = (a) => a * 2; return f(2) === 4;',
  letConst: 'let a = 1; const b = 2; { let a = 3; } return a + b === 3;',
  classes: 'class A { m() { return 1; } } class B extends A {} return new B().m() === 1;',
  templateLiterals: 'var x = 1; return `a${x}` === "a1";',
  destructuring: 'var { a, b: [c] } = { a: 1, b: [2] }; return a + c === 3;',
  defaultParams: 'function f(a = 2) { return a; } return f() === 2;',
  restParams: 'function f(...r) { return r.length; } return f(1, 2) === 2;',
  generators: 'function* g() { yield 1; } return g().next().value === 1;',
  exponentOperator: 'return 2 ** 10 === 1024;',
  asyncAwait: 'async function f() { await null; return 1; } return typeof f().then === "function";',
  trailingCommas: 'function f(a, b,) { return a + b; } return f(1, 2,) === 3;',
  objectSpread: 'var a = { x: 1 }; var b = { ...a, y: 2 }; return b.x === 1 && b.y === 2;',
  objectRestSpread:
    'var { a, ...r } = { a: 1, b: 2, c: 3 }; var o = { ...r }; return a === 1 && o.b === 2 && o.c === 3;',
  asyncGenerators: 'async function* g() { yield 1; } return typeof g().next === "function";',
  forAwait:
    'async function f() { for await (const x of [Promise.resolve(1)]) { return x; } } return typeof f === "function";',
  regexpLookbehind: 'return /(?<=a)b/.test("ab") && !/(?<=a)b/.test("cb");',
  namedGroups: 'return /(?<y>\\d+)/.exec("x42").groups.y === "42";',
  optionalCatchBinding: 'try { throw 1; } catch { return true; }',
  optionalChaining: 'var o = { a: { b: 1 } }; return o?.a?.b === 1 && o?.x?.y === undefined;',
  nullishCoalescing: 'return (null ?? 1) === 1 && (0 ?? 1) === 0;',
  bigIntLiteral: 'return typeof 1n === "bigint";',
  logicalAssignment: 'var a = null; a ??= 1; a ||= 2; a &&= 3; return a === 3;',
  numericSeparators: 'return 1_000 === 1000;',
  classFields: 'class A { x = 1; static y = 2; } return new A().x === 1 && A.y === 2;',
  privateFields:
    'class A { #x = 1; #m() { return this.#x; } get v() { return this.#m(); } } return new A().v === 1;',
  staticBlocks: 'class A { static z; static { A.z = 1; } } return A.z === 1;',
};

function syntaxChecks(): Record<string, { ok: boolean; error?: string }> {
  const result: Record<string, { ok: boolean; error?: string }> = {};
  // Control: if this fails, new Function itself is blocked (for example by a CSP), so every other
  // entry failing says nothing about ES support.
  try {
    result.functionConstructor = { ok: new Function('return 1')() === 1 };
  } catch (error) {
    result.functionConstructor = { ok: false, error: message(error) };
  }
  for (const name of Object.keys(SYNTAX)) {
    try {
      result[name] = { ok: new Function(SYNTAX[name]!)() === true };
    } catch (error) {
      result[name] = { ok: false, error: message(error) };
    }
  }
  return result;
}

/** Paths resolved from the global object; each reports its `typeof`, or `throws`. */
const BUILTINS = [
  'Symbol',
  'Map',
  'Set',
  'Proxy',
  'Reflect',
  'Object.entries',
  'Object.values',
  'Object.fromEntries',
  'Object.hasOwn',
  'Array.prototype.includes',
  'Array.prototype.flat',
  'Array.prototype.flatMap',
  'Array.prototype.at',
  'Array.prototype.findLast',
  'String.prototype.padStart',
  'String.prototype.replaceAll',
  'Promise.prototype.finally',
  'Promise.allSettled',
  'Promise.any',
  'structuredClone',
  'WeakRef',
  'FinalizationRegistry',
  'AbortController',
  'queueMicrotask',
  'globalThis',
  'Intl',
  'Intl.Segmenter',
  'URL',
  'TextEncoder',
  'requestIdleCallback',
  'ResizeObserver',
  'IntersectionObserver',
  'OffscreenCanvas',
  'createImageBitmap',
  'Worker',
  'SharedArrayBuffer',
  'WebAssembly',
  'AudioContext',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'crypto.randomUUID',
  'navigator.mediaDevices',
];

function builtins(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const path of BUILTINS) {
    try {
      let value: unknown = window;
      for (const part of path.split('.')) {
        value =
          value === null || value === undefined
            ? undefined
            : (value as Record<string, unknown>)[part];
      }
      result[path] = typeof value;
    } catch (error) {
      result[path] = `throws: ${message(error)}`;
    }
  }
  return result;
}

function webgl(kind: 'webgl' | 'webgl2'): unknown {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext(kind) as WebGLRenderingContext | null;
  if (!gl) return { context: false };
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const result = {
    context: true,
    version: attempt(() => gl.getParameter(gl.VERSION) as unknown),
    shadingLanguageVersion: attempt(() => gl.getParameter(gl.SHADING_LANGUAGE_VERSION) as unknown),
    vendor: attempt(() => gl.getParameter(gl.VENDOR) as unknown),
    renderer: attempt(() => gl.getParameter(gl.RENDERER) as unknown),
    unmaskedVendor: info
      ? attempt(() => gl.getParameter(info.UNMASKED_VENDOR_WEBGL) as unknown)
      : null,
    unmaskedRenderer: info
      ? attempt(() => gl.getParameter(info.UNMASKED_RENDERER_WEBGL) as unknown)
      : null,
    maxTextureSize: attempt(() => gl.getParameter(gl.MAX_TEXTURE_SIZE) as unknown),
  };
  // Free the context: engines cap how many can be live at once.
  const lose = gl.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();
  return result;
}

function canvas2d(): unknown {
  const ctx = document.createElement('canvas').getContext('2d');
  return { context: Boolean(ctx), filter: ctx ? 'filter' in ctx : null };
}

/** Rejects after `ms`, so one hung check cannot hold up the section. */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/** Settles to `{ ok: true, ... }` or `{ ok: false, error }`, never rejects or throws. */
function settle(check: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> {
  try {
    return check().then(
      (value) => ({ ok: true, ...value }),
      (error: unknown) => ({ ok: false, error: message(error) }),
    );
  } catch (error) {
    return Promise.resolve({ ok: false, error: message(error) });
  }
}

const WORKER_TIMEOUT_MS = 2000;

/** A Blob-URL Worker that posts back. Terminated and its URL revoked however it ends. */
function worker(): Promise<Record<string, unknown>> {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const url = URL.createObjectURL(new Blob(['postMessage("pong")'], { type: 'text/javascript' }));
    let instance: Worker | null = null;
    // The timeout runs after `done` exists; it is declared below so `done` can clear it.
    const timer = setTimeout(() => {
      done();
      reject(new Error(`worker timed out after ${WORKER_TIMEOUT_MS} ms`));
    }, WORKER_TIMEOUT_MS);
    const done = () => {
      clearTimeout(timer);
      if (instance) instance.terminate();
      URL.revokeObjectURL(url);
    };
    try {
      instance = new Worker(url);
    } catch (error) {
      done();
      reject(error);
      return;
    }
    instance.onmessage = (event) => {
      done();
      resolve({ message: event.data as unknown });
    };
    instance.onerror = (event) => {
      done();
      reject(new Error(event.message || 'worker error event'));
    };
  });
}

function fetchCheck(url: string, ms: number): Promise<Record<string, unknown>> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), ms) : 0;
  const request = fetch(url, controller ? { signal: controller.signal } : undefined).then(
    (response) =>
      response.text().then((text) => {
        clearTimeout(timer);
        return { status: response.status, type: response.type, bytes: text.length };
      }),
  );
  return withTimeout(request, ms + 500, 'fetch');
}

// butterchurn-srgb loads its presets over the network, so this is the fetch that matters.
const NETWORK_URL =
  'https://raw.githubusercontent.com/jberg/butterchurn-presets/master/package.json';
const STORAGE_KEY = 'srgb-probe:count';

/** The stored boot record, from this format or the earlier plain count. */
function parseBoot(raw: string | null): { count: number } & Record<string, unknown> {
  if (raw === null) return { count: 0 };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'number') return { count: parsed };
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      return { ...record, count: Number(record.count) || 0 };
    }
  } catch {
    // Fall through.
  }
  return { count: Number(raw) || 0 };
}

/**
 * Increments a counter in localStorage. `previous` is what the last load wrote, so its `bootId`
 * and `lastBoot` show whether storage survived a SignalRGB restart.
 */
function storageCount(): unknown {
  const raw = localStorage.getItem(STORAGE_KEY);
  const previous = parseBoot(raw);
  const written = {
    count: previous.count + 1,
    lastBoot: Date.now(),
    bootId: `${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(written));
  return { previousRaw: raw, previous: raw === null ? null : previous, written };
}

/** The sub-results so far; the REPORT reads it as `features`. */
const combined: { [group: string]: Json } = {};

function logGroup(group: string, data: unknown): void {
  const json = serialize(data);
  combined[group] = json;
  sections.features = combined;
  logJson(`features-${group}`, json);
}

function runGroup(group: string, collect: () => unknown): void {
  try {
    logGroup(group, collect());
  } catch (error) {
    logError(`features-${group}`, error);
  }
}

/** The quick, safe checks: syntax, builtins, 2D canvas and storage. */
export function collectSafeFeatures(): void {
  runGroup('syntax', syntaxChecks);
  runGroup('builtins', builtins);
  runGroup('canvas', canvas2d);
  runGroup('storage', storageCount);
}

/**
 * The checks that could hang or crash a fragile engine: WebGL, then a Worker, then fetch, one
 * after another. Run after the timing window, so a crash here cannot cost the earlier sections.
 */
export function collectRiskyFeatures(): Promise<void> {
  runGroup('webgl', () => ({
    webgl: attempt(() => webgl('webgl')),
    webgl2: attempt(() => webgl('webgl2')),
  }));
  return settle(worker)
    .then((result) => logGroup('worker', result))
    .then(() =>
      Promise.all([
        settle(() => fetchCheck('data:text/plain,ok', 3000)),
        settle(() => fetchCheck(NETWORK_URL, 3000)),
      ]),
    )
    .then(([data, network]) => logGroup('fetch', { data, network }))
    .then(undefined, (error: unknown) => logError('features', error));
}
