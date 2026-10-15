// JavaScript level and web features. The syntax checks are strings compiled with new Function, so
// the build never transpiles them: each one reports what the engine itself parses and runs.
import { attempt } from '../log';

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const SYNTAX: Record<string, string> = {
  optionalChaining: 'var o = { a: { b: 1 } }; return o?.a?.b === 1 && o?.x?.y === undefined;',
  nullishCoalescing: 'return (null ?? 1) === 1 && (0 ?? 1) === 0;',
  logicalAssignment: 'var a = null; a ??= 1; a ||= 2; a &&= 3; return a === 3;',
  numericSeparators: 'return 1_000 === 1000;',
  classFields: 'class A { x = 1; static y = 2; } return new A().x === 1 && A.y === 2;',
  privateFields:
    'class A { #x = 1; #m() { return this.#x; } get v() { return this.#m(); } } return new A().v === 1;',
  staticBlocks: 'class A { static z; static { A.z = 1; } } return A.z === 1;',
  bigIntLiteral: 'return typeof 1n === "bigint";',
  regexpLookbehind: 'return /(?<=a)b/.test("ab") && !/(?<=a)b/.test("cb");',
  namedGroups: 'return /(?<y>\\d+)/.exec("x42").groups.y === "42";',
  asyncGenerators: 'async function* g() { yield 1; } return typeof g().next === "function";',
  forAwait:
    'async function f() { for await (const x of [Promise.resolve(1)]) { return x; } } return typeof f === "function";',
  exponentOperator: 'return 2 ** 10 === 1024;',
  objectSpread: 'var a = { x: 1 }; var b = { ...a, y: 2 }; return b.x === 1 && b.y === 2;',
};

function syntaxChecks(): Record<string, { ok: boolean; error?: string }> {
  const result: Record<string, { ok: boolean; error?: string }> = {};
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
  'Array.prototype.at',
  'Array.prototype.findLast',
  'Object.hasOwn',
  'String.prototype.replaceAll',
  'structuredClone',
  'Promise.any',
  'Promise.allSettled',
  'WeakRef',
  'FinalizationRegistry',
  'AbortController',
  'queueMicrotask',
  'globalThis',
  'Intl.Segmenter',
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

/** Settles to `{ ok: true, ... }` or `{ ok: false, error }`, never rejects. */
const settle = (promise: Promise<Record<string, unknown>>): Promise<Record<string, unknown>> =>
  promise.then(
    (value) => ({ ok: true, ...value }),
    (error: unknown) => ({ ok: false, error: message(error) }),
  );

function worker(): Promise<Record<string, unknown>> {
  return withTimeout(
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const url = URL.createObjectURL(
        new Blob(['postMessage("pong")'], { type: 'text/javascript' }),
      );
      const instance = new Worker(url);
      const done = () => {
        instance.terminate();
        URL.revokeObjectURL(url);
      };
      instance.onmessage = (event) => {
        done();
        resolve({ message: event.data as unknown });
      };
      instance.onerror = (event) => {
        done();
        reject(new Error(event.message || 'worker error event'));
      };
    }),
    2000,
    'worker',
  );
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

function storageCount(): unknown {
  const previous = localStorage.getItem(STORAGE_KEY);
  const next = (Number(previous) || 0) + 1;
  localStorage.setItem(STORAGE_KEY, String(next));
  return { previous, written: next };
}

const run = (check: () => Promise<Record<string, unknown>>): Promise<Record<string, unknown>> => {
  try {
    return settle(check());
  } catch (error) {
    return Promise.resolve({ ok: false, error: message(error) });
  }
};

/** Every feature check; resolves once the async ones (worker, fetch) have settled. */
export function collectFeatures(): Promise<unknown> {
  const sync = {
    syntax: attempt(syntaxChecks),
    builtins: attempt(builtins),
    webgl: attempt(() => webgl('webgl')),
    webgl2: attempt(() => webgl('webgl2')),
    canvas2d: attempt(canvas2d),
    localStorage: attempt(storageCount),
  };
  return Promise.all([
    run(worker),
    run(() => fetchCheck('data:text/plain,ok', 3000)),
    run(() => fetchCheck(NETWORK_URL, 3000)),
  ]).then(([workerResult, dataFetch, networkFetch]) => ({
    ...sync,
    worker: workerResult,
    fetchData: dataFetch,
    fetchNetwork: networkFetch,
  }));
}
