# srgb-effect-kit Devtools (Plan 2 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `vite` dev, make every SignalRGB global exist and behave as in SignalRGB before effect code runs, and add a devtools drawer that drives them (properties, audio, screen zones, meters, canvas API events, renderer/FPS simulation, a SignalRGB view and a console counter), with nothing of it in the build. The `devtools` option selects one of three modes:
- `'none'`: nothing is injected.
- `'minimal'`: SignalRGB's environment only, with nothing visible.
- `'full'` (the default): the environment plus the drawer.

**Architecture:**
- `srgbEffect()` gains a fourth, serve-only plugin, `srgb-effect:devtools`, unless `devtools` is `'none'`. It injects `<script type="module" src="/@id/__x00__virtual:srgb-effect/devtools">` at the start of `<head>`. Vite prefixes `base` itself. Module scripts run in document order, so this one runs before the effect's.
- The virtual module imports a devtools bundle by absolute path and calls `startDevtools(config, { hot: import.meta.hot })`. The config (manifest plus `fireChangedOnLoad`) is inlined as JSON.
- There are two bundles, `minimal` and `index` (full). Each is built by its own tsdown config, so each is self-contained, and `minimal` never contains drawer, tab, renderer or console-counter code.
- The bundle for the mode is resolved next to the plugin: `dist/devtools/{minimal,index}.js` when the plugin runs from the built package, or `src/devtools/{minimal,index}.ts` when it runs from source (vitest).
- Both entries share `startSimulation()`. It runs synchronously and:
  1. defines the handler globals;
  2. sets the property globals in raw format;
  3. installs the `engine` mock;
  4. wires the `POST /canvas/event` relay (Vite WebSocket → `onCanvasApiEvent`);
  5. on `DOMContentLoaded`, after every module script has run, calls each `on<Prop>Changed` in property order.
- The `minimal` entry passes `NO_STORAGE`, so globals always start at the manifest defaults.
- The full entry also:
  - persists values in localStorage;
  - applies the renderer simulation (user agent, rAF throttle);
  - wraps the console;
  - drives audio and screen;
  - mounts the drawer in an open Shadow DOM on `<html>` after the load-time calls.
- Logic lives in small modules with complete code and tests. The UI is vanilla TS with CSS in a TS string.

**Tech Stack:** TypeScript ~6.0, Vite 8.3 (Rolldown), tsdown 0.23, vitest 5 + jsdom 30, @playwright/test 1.64 (Chromium), pnpm 10 workspaces, ESLint 10, Prettier 3.

**Spec:** `.superpowers/specs/2026-10-13-srgb-effect-kit-design.md`, §10 for the devtools and §11 for testing. Also see §3 for the SignalRGB facts and §5–§6 for the options and the prelude. Plan 1 is `.superpowers/plans/2026-10-13-srgb-effect-kit-core.md`. The code has moved past both documents, and the code is the truth. Task 12 records where this plan refines the spec.

**Scope:** This is Plan 2 of 3.
- Plan 3 is the probe effect (spec §9). Its findings replace the placeholders this plan uses:
  - the user agents (`SIMULATED_USER_AGENTS`);
  - the raw formats;
  - the load-time firing order;
  - the zone value scale.
- The final task migrates butterchurn-srgb, a separate repo, onto the new devtools.

## Global Constraints

- **Dependencies:** add no runtime dependencies to `srgb-effect-kit`. The devtools are vanilla TypeScript, with CSS as a TS string inside an **open** Shadow DOM, and no UI framework. The only new dev dependencies are root `@playwright/test@^1.64.1` and `@types/node@^26.6.5`.
- **The `devtools` option:** `devtools?: 'none' | 'minimal' | 'full' | { mode?: 'none' | 'minimal' | 'full'; fireChangedOnLoad?: boolean }`, with a default of `'full'`.
  - `ResolvedOptions.devtools` is `{ mode, fireChangedOnLoad }`.
  - A string means `{ mode, fireChangedOnLoad: true }`.
  - `true`, `false` and unknown modes throw `[srgb-effect] devtools must be 'none', 'minimal', 'full' or { mode, fireChangedOnLoad } …`. The package is pre-release, so there is no boolean compatibility.
- **What each mode injects:**
  - `'none'` injects nothing in dev.
  - `'minimal'` provides:
    - the handler prelude;
    - property globals at the manifest **defaults**, with no localStorage;
    - the `engine` mock;
    - the load-time calls;
    - the `POST /canvas/event` relay.

    It provides nothing visible: no drawer, no marker, no renderer simulation and no console counter. Its bundle must not contain that code.
  - `'full'` is `'minimal'` plus everything else in this plan.
- **When the devtools run:** only under `vite` serve (`apply: 'serve'`). They never appear in build output: the strings `srgb-effect-devtools`, `srgb-effect/devtools` and `srgb-effect-kit:` must not occur in a built effect.
- **Packaging:** the devtools are two internal tsdown entries, `dist/devtools/index.js` (full) and `dist/devtools/minimal.js`. Each is built by its own config (`platform: 'browser'`, `dts: false`), so each bundle is self-contained. They are **not** in `package.json#exports`.
- **Boundaries:** these are enforced by ESLint from Task 1.
  - `src/devtools/**` imports only `src/shared/**` and `src/runtime/**`. It must not import `node:*` or `vite`.
  - `src/vite/**` never imports `src/devtools/**`.
- **Globals are SignalRGB's own, with no wrappers.** The devtools set `window.<property>` in raw format:

  | Type | Raw value |
  |---|---|
  | `number`, `hue` | number |
  | `boolean` | `'0'` / `'1'` (`SRGBBoolean`) |
  | `color` | `#rrggbb` string |
  | `textfield`, `list` | string |

  A change sets the global **first**, then calls `window.on<Prop>Changed?.()` with **no arguments**. Setting a value equal to the current one does nothing.
- **Load-time calls:** in both modes, if `fireChangedOnLoad` (default `true`), every `on<Prop>Changed` is called in property order on `DOMContentLoaded`. A handler that throws is reported with `reportError` and the remaining handlers still run.
- **localStorage keys** (full mode only): the format is `srgb-effect-kit:<title>:<key>`. The keys are `properties`, `drawer`, `audio`, `screen`, `meters`, `renderer` and `canvas-api`. Every read is validated, and every storage access tolerates blocked or full storage.
- **Visible area:** the top-left 320×200 (`VISIBLE_WIDTH`, `VISIBLE_HEIGHT`).
- **Simulated user agents:** these are placeholders equal to the fixtures in `src/runtime/renderer.test.ts`. They must satisfy `RENDERER_SIGNATURES` (a test checks this).
- **DOM hooks:** these attributes are the test contract. Keep the names exactly:
  - `data-srgb-devtools`
  - `data-srgb-devtools-tab`
  - `data-srgb-property`
  - `data-srgb-control`
  - `data-srgb-audio-mode`
  - `data-srgb-screen-source`
  - `data-srgb-meter`, `data-srgb-meter-control`, `data-srgb-meter-value`
  - `data-srgb-renderer`
  - `data-srgb-console`

  The shadow host tag is `srgb-effect-devtools`.
- **Untrusted strings:** manifest strings (labels, tooltips, list values, meter names) never pass through `innerHTML`. Use the `h()` helper, which appends text nodes.
- **Messages:** every error and warning message starts with `[srgb-effect]`.
- **Tests:** devtools test files that need a DOM start with `// @vitest-environment jsdom`. Shared fixtures live in `packages/srgb-effect-kit/test/helpers/devtools.ts`.
- **End-to-end tests:** the examples consume `packages/srgb-effect-kit/dist`, so run `pnpm build` before `pnpm test:e2e`. Locally, either run `CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e` or install Playwright's browser once with `pnpm exec playwright install chromium`. The cached `chromium-1155` is older than the build that Playwright 1.64 expects.
- **CI:** CI runs `pnpm lint && pnpm format && pnpm build && pnpm typecheck && pnpm test`, plus an `e2e` job (Task 3). If Prettier flags a file, run `pnpm format:fix` before committing.
- **Commits:** every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `feat/devtools`, where this plan is already committed.

## Review Focus

1. **Stale or corrupt persisted state.** Examples: a renamed property, a removed list value, a narrowed range, broken JSON, or blocked storage. The page must still boot, with defaults or clamped values, and must never expose a raw value that is invalid for the property. *Tests:*
   - Task 1 `restores persisted values and falls back to defaults for stale ones`;
   - Task 1 `keeps working when storage is unavailable or throws`;
   - Task 5 `ignores invalid stored settings and clamps the FPS`;
   - Task 6 `restores persisted state, falling back for unknown tabs and invalid data`;
   - Task 9 `ignores persisted captures and invalid sources`.
2. **An effect handler that throws**, either during the load-time calls or on a change. The remaining handlers still run, and the error surfaces like an uncaught one, so the Console tab counts it. *Tests:*
   - Task 1 `keeps firing when a handler throws, and reports the error`;
   - Task 1 `reports what the handler throws instead of rethrowing`;
   - Task 2 `records unhandled events and reports handler errors`.
3. **Effect code that rewrites `<body>`** (`document.body.innerHTML = …`) or styles `body > *`. The drawer must survive and must not change the effect's layout or swallow its clicks. *Test:* Task 6 `survives effect code that clears the body` and `mounts a closed drawer in an open shadow root on <html>`, which checks `pointer-events: none` on the host.
4. **Manifest strings containing HTML**, such as a label `<img src=x onerror=…>` or a list value `a&b`. These must render as text, and the value must round-trip unchanged. *Tests:* Task 7 `renders labels and list values as text`, and Task 6 `sets attributes and appends children as text, never HTML`.
5. **A config written for the old boolean option** (`devtools: false` or `true`), or a misspelled mode. Without a check, `false` would silently mean `'full'`; instead it must fail at config time with a message that lists the valid forms. *Test:* Task 2 `rejects the old boolean form and unknown modes`, plus the `@ts-expect-error` in `index.test-d.ts`. A non-root `base` is covered too, by Task 2 `prefixes the script URL with a custom base` and `keeps the endpoint at /canvas/event under a custom base`.

## Verified during planning

All task code below ran in a scratch copy of the repo. After each task, the following passed:
- `tsc`, vitest, ESLint and Prettier;
- the Playwright e2e suite, against `examples/basic-2d` and Chromium 154, after Tasks 3, 6, 7, 8 and 11.

Facts the design relies on:
- **Script order:** a `transformIndexHtml` tag with `injectTo: 'head-prepend'` and `order: 'pre'` runs before the effect's body module script. The effect's top level sees the globals.
- **Base prefix:** Vite prefixes `base` onto the root-relative `src="/@id/__x00__virtual:srgb-effect/devtools"` (checked with `/sub/`).
- **Load-time calls:** `DOMContentLoaded` fires after the module scripts, and the load-time calls reach the effect's handlers.
- **Serving the bundle:** the virtual module's `import "<abs path>"` is rewritten to `/@fs/…` and served even when the file is outside `server.fs.allow`, because Vite adds resolved import ids to `safeModulePaths`. It works from `node_modules` and from a directory outside the workspace.
- **Canvas relay:** `server.ws.send('srgb-effect:canvas-event', data)` → `import.meta.hot.on(…)` works in the virtual module.
- **Middleware order:** a `configureServer` middleware sees the raw URL before Vite's base handling. Vite's CORS middleware runs **before** plugin middlewares and answers `OPTIONS` preflights itself. That is why the endpoint does not handle `OPTIONS`.
- **tsdown:** one config per devtools entry (`platform: 'browser'`, `dts: false`) emits self-contained `dist/devtools/index.js` (about 77 KB) and `dist/devtools/minimal.js` (about 9 KB). Each has no imports and exports only `startDevtools`. `minimal.js` contains none of `srgb-effect-devtools`, `:host`, `Ultralight/` and `[vite]`, so no drawer, styles, renderer simulation or console counter. `dist/vite/index.js` keeps `import.meta.url`, so each entry resolves relative to it.
- **Minimal mode in the browser:** the e2e test sees `/devtools/minimal.js` requested and `/devtools/index.js` never requested. Globals start at their defaults even with stored values, the handler fires once, the canvas relay works and no host element exists. In `'none'` there are no globals and `POST /canvas/event` returns 404.
- **Playwright:**
  - `locator.fill()` works on `input[type=range]` and `input[type=color]`, and locators pierce open shadow roots.
  - Playwright 1.64.1 drives `/usr/bin/chromium` 154 through `launchOptions.executablePath`.
  - Overriding `navigator.userAgent` with `Object.defineProperty` works in Chromium and jsdom.
- **jsdom 30 (vitest):**
  - supports `attachShadow` and `localStorage` (at `http://localhost:3000`);
  - has `requestAnimationFrame` but no `reportError`;
  - has no canvas implementation, so tabs must tolerate `getContext('2d') === null`;
  - reports `readyState === 'complete'`.

---

## File Map

```text
.
├─ package.json                         + test:e2e, typecheck runs tsc -p e2e, devDeps @playwright/test, @types/node
├─ playwright.config.ts                 NEW  Chromium; dev servers: basic-2d (full) :5310, modes fixture minimal :5311 / none :5312
├─ e2e/ helpers.ts devtools.spec.ts tsconfig.json   NEW
├─ e2e/fixtures/modes/ vite.config.mjs index.html main.js   NEW  one-property fixture, mode from SRGB_DEVTOOLS_MODE
├─ eslint.config.js                     devtools/vite boundary rules, ignore test-results/playwright-report
├─ .gitignore                           + test-results, playwright-report
├─ .github/workflows/ci.yml             + e2e job
├─ docs/devtools.md                     NEW; caveats removed across docs/, READMEs, example READMEs
├─ .superpowers/specs/…-design.md       §10/§11 refined, Plan 2 deltas recorded
└─ packages/srgb-effect-kit/
   ├─ package.json                      version 0.1.0 (Task 13)
   ├─ tsdown.config.ts                  + devtools/index and devtools/minimal browser entries
   ├─ test/helpers/devtools.ts          NEW fixture manifest + jsdom window reset
   ├─ test/devtoolsPlugin.test.ts       NEW
   └─ src/
      ├─ shared/  devtoolsProtocol.ts (NEW: ids, CANVAS_EVENT, DevtoolsConfig), prelude.ts (+handlerGlobalNames), index.ts
      ├─ vite/    devtoolsEntry.ts, devtoolsPlugin.ts (NEW), index.ts (+plugin), options.ts (devtools modes)
      └─ devtools/
         ├─ index.ts            startDevtools for 'full' (dist/devtools/index.js)
         ├─ minimal.ts          startDevtools for 'minimal' (dist/devtools/minimal.js)
         ├─ simulation.ts       startSimulation (shared environment), findInstance, rememberInstance
         ├─ context.ts          StartOptions, SimulationContext, DevtoolsContext, DevtoolsWindow, FrameScheduler, HotBridge, globalsOf
         ├─ lifecycle.ts        onDomReady, reportError, callGlobal
         ├─ storage.ts          createStorage (namespaced, fault tolerant), NO_STORAGE, isRecord
         ├─ properties.ts       raw formats + PropertyController
         ├─ engine.ts           MockEngine, createEngineMock, initialMeterValue
         ├─ canvasApi.ts        toCanvasApiEvent, CanvasApiController
         ├─ audio.ts            frame math (random, level, width, density)
         ├─ zones.ts            solid/gradient fill, pixel sampling
         ├─ meters.ts           regions, resolution overrides, HSL evaluation, manual clamping
         ├─ renderer.ts         simulated UAs, rAF throttle, RendererController
         ├─ consoleCounter.ts   console + uncaught error counts
         ├─ audioController.ts  audio modes + getUserMedia/getDisplayMedia capture
         ├─ screenController.ts zone sources + screen capture + meter values
         └─ ui/
            ├─ dom.ts styles.ts overlay.ts drawer.ts index.ts
            └─ tabs/ index.ts properties.ts audio.ts screen.ts meters.ts canvasApi.ts renderer.ts view.ts console.ts
```

Logic modules have a sibling `*.test.ts`. The files without one are:
- `context.ts`, which holds types only;
- `engine.ts` and `simulation.ts`, which `index.test.ts` and `minimal.test.ts` cover;
- `styles.ts`;
- `tabs/index.ts`, which `ui/index.test.ts` covers;
- the browser-only capture glue: `openAudioCapture`, `openScreenCapture` and the tab capture in `view.ts`. jsdom cannot run these, so Task 11 checks them by hand.
---


### Task 1: Devtools core: protocol, storage, raw property formats, engine mock, bootstrap

**Files:**
- Create: `packages/srgb-effect-kit/src/shared/devtoolsProtocol.ts`
- Modify: `packages/srgb-effect-kit/src/shared/index.ts`, `packages/srgb-effect-kit/src/shared/prelude.ts`, `packages/srgb-effect-kit/src/shared/prelude.test.ts`
- Create: `packages/srgb-effect-kit/src/devtools/{context,lifecycle,storage,engine,properties,simulation,index}.ts`
- Create: `packages/srgb-effect-kit/test/helpers/devtools.ts`
- Modify: `eslint.config.js`
- Test: `packages/srgb-effect-kit/src/devtools/{lifecycle,storage,properties,index}.test.ts`

**Interfaces:**
- Consumes:
  - From `src/shared`: `EffectManifest`, `PropertyDef`, `MeterDef`, `handlerName`.
  - From `src/runtime`: `SRGBEngine`, `FREQUENCY_BINS`, `ZONE_COLUMNS`, `ZONE_ROWS`.
- Produces:
  - **`shared/devtoolsProtocol.ts`:**
    - `DEVTOOLS_MODULE_ID = 'virtual:srgb-effect/devtools'`
    - `CANVAS_EVENT = 'srgb-effect:canvas-event'`
    - `CANVAS_EVENT_PATH = '/canvas/event'`
    - `interface DevtoolsConfig { manifest: EffectManifest; fireChangedOnLoad: boolean }`
  - **`shared/prelude.ts`:** `handlerGlobalNames(manifest): string[]`. `generatePrelude` now uses it.
  - **`devtools/context.ts`:**
    - `type DevtoolsWindow = Window & typeof globalThis`
    - `interface FrameScheduler { request(cb): number; cancel(id): void }`
    - `interface HotBridge { on(event, listener: (data: unknown) => void): void }`
    - `interface StartOptions { hot?: HotBridge; win?: DevtoolsWindow }`
    - `interface SimulationContext { config; win; properties; engine }`. This is what both modes provide; Task 2 adds `canvasApi`.
    - `interface DevtoolsContext extends SimulationContext { storage; raf }`. This is the full mode; later tasks add fields.
    - `globalsOf(win): Record<string, unknown>`
  - **`devtools/lifecycle.ts`:**
    - `onDomReady(win, cb)`
    - `reportError(win, error)`
    - `callGlobal(win, name, ...args): boolean`
  - **`devtools/storage.ts`:**
    - `STORAGE_PREFIX`
    - `interface DevtoolsStorage { prefix; read<T>(key, isValid): T | undefined; write(key, value); remove(key) }`
    - `createStorage(title, getStorage)`
    - `NO_STORAGE`: keeps nothing; used by the minimal mode
    - `isRecord(value)`
  - **`devtools/engine.ts`:**
    - `MockAudio`, `MockZone`, `MockEngine`
    - `initialMeterValue(meter)`
    - `createEngineMock(meters?)`
  - **`devtools/properties.ts`:**
    - `type RawValue = number | string`
    - `propertyRange(p)`, `defaultRaw(p)`, `coerceRaw(p, value)`
    - `interface PropertyController { definitions; get; set; reset; fireAll; subscribe }`
    - `createPropertyController(definitions, storage, win)`
  - **`devtools/simulation.ts`:**
    - `startSimulation(config, win, storage): SimulationContext`. It covers the handler globals, the property globals and the engine mock, and calls the handlers on DOM ready. Task 2 adds a `hot` parameter and the canvas relay.
    - `findInstance<T>(win)` and `rememberInstance(win, context)`. These guard against a second start, using `Symbol.for('srgb-effect-kit.devtools')`.
  - **`devtools/index.ts`:** the full-mode entry.
    - `startDevtools(config, options?): DevtoolsContext`
    - re-exports `type DevtoolsContext` and `type StartOptions`
  - **`test/helpers/devtools.ts`:**
    - `MANIFEST`: one property of every type and one meter of every type, title `'Devtools Test'`
    - `CONFIG`
    - `GLOBAL_NAMES`
    - `resetDevtoolsWindow()`, `setReadyState(state)`, `restoreReadyState()`

- [ ] **Step 1: Add the shared protocol module and `handlerGlobalNames`**

`packages/srgb-effect-kit/src/shared/devtoolsProtocol.ts`. The file name must not be `devtools.ts`: the shared/ lint rule bans any import path that matches `**/devtools`.
```ts
import type { EffectManifest } from './types';

/** Id of the virtual module the dev server injects to start the devtools. */
export const DEVTOOLS_MODULE_ID = 'virtual:srgb-effect/devtools';
/** Vite custom WebSocket event that carries canvas API events from the dev server to the page. */
export const CANVAS_EVENT = 'srgb-effect:canvas-event';
/** Dev-server path that mirrors SignalRGB's `POST /canvas/event?sender=…&event=…` endpoint. */
export const CANVAS_EVENT_PATH = '/canvas/event';

/** What the dev server passes to the devtools bootstrap. */
export interface DevtoolsConfig {
  manifest: EffectManifest;
  /** Call every on<Prop>Changed once at load, like SignalRGB does. */
  fireChangedOnLoad: boolean;
}
```

In `packages/srgb-effect-kit/src/shared/index.ts`, replace:

Replace:

```ts
export * from './html';
```

with:

```ts
export * from './devtoolsProtocol';
export * from './html';
```

Replace `packages/srgb-effect-kit/src/shared/prelude.ts` with:
```ts
import { handlerName } from './names';
import type { EffectManifest } from './types';

/** Every handler global SignalRGB may call: each property's `on<Prop>Changed`, then `onCanvasApiEvent`. */
export const handlerGlobalNames = (manifest: EffectManifest): string[] => [
  ...(manifest.properties ?? []).map((p) => handlerName(p.property)),
  'onCanvasApiEvent',
];

/**
 * ES5 snippet run before effect code. It makes sure every handler global exists on window,
 * so a bare `onSpeedChanged = …` in strict module code does not throw a ReferenceError.
 */
export function generatePrelude(manifest: EffectManifest): string {
  const names = handlerGlobalNames(manifest);
  return `(function(){var w=window,n=${JSON.stringify(names)};for(var i=0;i<n.length;i++){if(!(n[i] in w))w[n[i]]=undefined;}})();`;
}
```

In `packages/srgb-effect-kit/src/shared/prelude.test.ts`, replace:

Replace:

```ts
import { generatePrelude } from './prelude';
```

with:

```ts
import { generatePrelude, handlerGlobalNames } from './prelude';
```

Then append this test to the same file:
```ts

describe('handlerGlobalNames', () => {
  it('lists each property handler in order, then onCanvasApiEvent', () => {
    expect(
      handlerGlobalNames({
        title: 'T',
        properties: [
          { property: 'speed', type: 'number', label: 'S', min: 0, max: 1, default: 0 },
          { property: 'mode', type: 'list', label: 'M', values: ['A'], default: 'A' },
        ],
      }),
    ).toEqual(['onSpeedChanged', 'onModeChanged', 'onCanvasApiEvent']);
    expect(handlerGlobalNames({ title: 'T' })).toEqual(['onCanvasApiEvent']);
  });
});
```

- [ ] **Step 2: Add the lint boundaries for `devtools/` and `vite/`**

In `eslint.config.js`, make these replacements:

1. Replace:

```js
const SHARED_MESSAGE = 'shared/ is isomorphic: no Node, Vite, runtime or devtools imports.';
```

with:

```js
const SHARED_MESSAGE = 'shared/ is isomorphic: no Node, Vite, runtime or devtools imports.';
const DEVTOOLS_MESSAGE = 'devtools/ runs in the browser: no Node or Vite imports.';
const VITE_MESSAGE = 'vite/ runs in Node: load devtools/ through the dev server, never import it.';
```

2. Replace:

```js
  prettier,
);
```

with:

```js
  {
    files: ['packages/srgb-effect-kit/src/devtools/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeBuiltins(DEVTOOLS_MESSAGE),
          patterns: [
            {
              group: ['node:*', 'vite', 'vite/*', '**/vite', '**/vite/**'],
              message: DEVTOOLS_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/srgb-effect-kit/src/vite/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/devtools', '**/devtools/**'], message: VITE_MESSAGE }] },
      ],
    },
  },
  prettier,
);
```

Run: `pnpm lint`
Expected: PASS. No devtools code exists yet; the new rules start to apply in Step 4.

- [ ] **Step 3: Write the shared jsdom test helper and the failing tests**

`packages/srgb-effect-kit/test/helpers/devtools.ts`:
```ts
import type { DevtoolsConfig, EffectManifest } from '../../src/shared';

/** One property of every type and one meter of every type. */
export const MANIFEST = {
  title: 'Devtools Test',
  properties: [
    { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
    { property: 'baseHue', type: 'hue', label: 'Hue', default: 120 },
    { property: 'rainbow', type: 'boolean', label: 'Rainbow', default: true },
    { property: 'tint', type: 'color', label: 'Tint', default: '#009bde' },
    { property: 'text', type: 'textfield', label: 'Text', default: '' },
    { property: 'mode', type: 'list', label: 'Mode', values: ['Wave', 'Pulse'], default: 'Wave' },
  ],
  meters: [
    {
      meter: 'health',
      type: 'linear',
      x: 0.1,
      y: 0.5,
      width: 0.5,
      h: [100, 140],
      s: [50, 100],
      l: [25, 75],
    },
    {
      meter: 'mana',
      type: 'area',
      x: 0,
      y: 0,
      width: 0.5,
      height: 0.5,
      h: [200, 260],
      s: [50, 100],
      l: [25, 75],
      resolutions: [{ size: '1920x1080', x: 0.5 }],
    },
    {
      meter: 'victory',
      type: 'ocr_textmatch',
      x: 0,
      y: 0,
      width: 0.2,
      height: 0.1,
      string: 'VICTORY',
    },
    { meter: 'score', type: 'ocr_numeric', x: 0, y: 0, width: 0.2, height: 0.1 },
  ],
} as const satisfies EffectManifest;

export const CONFIG: DevtoolsConfig = { manifest: MANIFEST, fireChangedOnLoad: true };

/** Globals the devtools define for MANIFEST. */
export const GLOBAL_NAMES = [
  ...MANIFEST.properties.map((p) => p.property),
  'onSpeedChanged',
  'onBaseHueChanged',
  'onRainbowChanged',
  'onTintChanged',
  'onTextChanged',
  'onModeChanged',
  'onCanvasApiEvent',
  'engine',
];

/** Undoes everything `startDevtools()` did to the jsdom window, so each test starts clean. */
export function resetDevtoolsWindow(): void {
  const globals = window as unknown as Record<PropertyKey, unknown>;
  for (const name of GLOBAL_NAMES) delete globals[name];
  // Flush DOM-ready listeners left by earlier tests (they are `once`); no handler exists now.
  document.dispatchEvent(new Event('DOMContentLoaded'));
  delete globals[Symbol.for('srgb-effect-kit.devtools')];
  localStorage.clear();
  document.body.replaceChildren();
  for (const host of document.querySelectorAll('srgb-effect-devtools')) host.remove();
}

/** Pretends the document is still parsing, as it is while module scripts run in a browser. */
export function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state });
}

/** Restores jsdom's own `readyState` ('complete'). */
export function restoreReadyState(): void {
  delete (document as unknown as Record<string, unknown>).readyState;
}
```

`packages/srgb-effect-kit/src/devtools/storage.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createStorage, isRecord, NO_STORAGE } from './storage';

const isNumber = (value: unknown): value is number => typeof value === 'number';

afterEach(() => localStorage.clear());

describe('createStorage', () => {
  it('namespaces keys by effect title', () => {
    const a = createStorage('Effect A', () => localStorage);
    const b = createStorage('Effect B', () => localStorage);
    a.write('speed', 1);
    b.write('speed', 2);
    expect(a.prefix).toBe('srgb-effect-kit:Effect A:');
    expect(localStorage.getItem('srgb-effect-kit:Effect A:speed')).toBe('1');
    expect(a.read('speed', isNumber)).toBe(1);
    expect(b.read('speed', isNumber)).toBe(2);
    a.remove('speed');
    expect(a.read('speed', isNumber)).toBeUndefined();
    expect(b.read('speed', isNumber)).toBe(2);
  });

  it('returns undefined for missing, unparsable or invalid values', () => {
    const storage = createStorage('T', () => localStorage);
    expect(storage.read('missing', isNumber)).toBeUndefined();
    localStorage.setItem('srgb-effect-kit:T:broken', '{not json');
    expect(storage.read('broken', isNumber)).toBeUndefined();
    storage.write('text', 'hello');
    expect(storage.read('text', isNumber)).toBeUndefined();
  });

  it('keeps working when storage is unavailable or throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    for (const getStorage of [
      () => undefined,
      () => throwing,
      () => {
        throw new Error('SecurityError');
      },
    ]) {
      const storage = createStorage('T', getStorage);
      expect(() => storage.write('a', 1)).not.toThrow();
      expect(storage.read('a', isNumber)).toBeUndefined();
      expect(() => storage.remove('a')).not.toThrow();
    }
  });
});

describe('NO_STORAGE', () => {
  it('keeps nothing', () => {
    NO_STORAGE.write('a', 1);
    expect(NO_STORAGE.read('a', isNumber)).toBeUndefined();
    expect(localStorage.length).toBe(0);
  });
});

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });
});
```

`packages/srgb-effect-kit/src/devtools/lifecycle.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { restoreReadyState, setReadyState } from '../../test/helpers/devtools';
import { callGlobal, onDomReady, reportError } from './lifecycle';

const globals = window as unknown as Record<string, unknown>;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  delete globals.handler;
  restoreReadyState();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('onDomReady', () => {
  it('waits for DOMContentLoaded while the document is parsing', () => {
    setReadyState('interactive');
    const callback = vi.fn();
    onDomReady(window, callback);
    vi.runAllTimers();
    expect(callback).not.toHaveBeenCalled();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(callback).toHaveBeenCalledOnce();
  });

  it('runs on the next task once the document is complete', () => {
    const callback = vi.fn();
    onDomReady(window, callback);
    expect(callback).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(callback).toHaveBeenCalledOnce();
  });
});

describe('callGlobal', () => {
  it('calls a global function with the given arguments and window as this', () => {
    const handler = vi.fn(function (this: unknown) {
      return this;
    });
    globals.handler = handler;
    expect(callGlobal(window, 'handler', 1, 'a')).toBe(true);
    expect(handler).toHaveBeenCalledWith(1, 'a');
    expect(handler.mock.results[0]?.value).toBe(window);
  });

  it('returns false when the global is not a function', () => {
    globals.handler = 'nope';
    expect(callGlobal(window, 'handler')).toBe(false);
    expect(callGlobal(window, 'missing')).toBe(false);
  });

  it('reports what the handler throws instead of rethrowing', () => {
    const report = vi.fn();
    vi.stubGlobal('reportError', report);
    const error = new Error('boom');
    globals.handler = () => {
      throw error;
    };
    expect(() => callGlobal(window, 'handler')).not.toThrow();
    expect(report).toHaveBeenCalledWith(error);
  });
});

describe('reportError', () => {
  it('falls back to rethrowing on a timer without window.reportError', () => {
    vi.stubGlobal('reportError', undefined);
    const error = new Error('later');
    reportError(window, error);
    expect(() => vi.runAllTimers()).toThrow(error);
  });
});
```

`packages/srgb-effect-kit/src/devtools/properties.test.ts`:
```ts
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
```

`packages/srgb-effect-kit/src/devtools/index.test.ts`:
```ts
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
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools src/shared/prelude.test.ts`
Expected: FAIL. The `./storage`, `./lifecycle`, `./properties` and `./index` modules cannot be resolved. The prelude tests already pass after Step 1.

- [ ] **Step 4: Implement the modules**

`packages/srgb-effect-kit/src/devtools/context.ts`:
```ts
import type { DevtoolsConfig } from '../shared';
import type { MockEngine } from './engine';
import type { PropertyController } from './properties';
import type { DevtoolsStorage } from './storage';

/** The effect page's window. */
export type DevtoolsWindow = Window & typeof globalThis;

/** `requestAnimationFrame`/`cancelAnimationFrame`, captured before any renderer simulation patches them. */
export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

/** The part of Vite's `import.meta.hot` the devtools use. */
export interface HotBridge {
  on(event: string, listener: (data: unknown) => void): void;
}

/** Options for `startDevtools()`, in both entries. */
export interface StartOptions {
  /** Vite's `import.meta.hot`, for events from the dev server. */
  hot?: HotBridge;
  /** The effect page's window. @default window */
  win?: DevtoolsWindow;
}

/** The SignalRGB environment: what both the `minimal` and the `full` mode provide. */
export interface SimulationContext {
  readonly config: DevtoolsConfig;
  readonly win: DevtoolsWindow;
  readonly properties: PropertyController;
  readonly engine: MockEngine;
}

/** Everything the `full` bootstrap creates; the drawer's tabs read and drive it. */
export interface DevtoolsContext extends SimulationContext {
  readonly storage: DevtoolsStorage;
  /** The page's native rAF, unaffected by the UltraLight simulation. */
  readonly raf: FrameScheduler;
}

/** The window as a bag of globals, for names only known at runtime (property globals, handlers). */
export const globalsOf = (win: DevtoolsWindow): Record<string, unknown> =>
  win as unknown as Record<string, unknown>;
```

`packages/srgb-effect-kit/src/devtools/lifecycle.ts`:
```ts
import { globalsOf, type DevtoolsWindow } from './context';

/**
 * Runs `callback` once every deferred script, including all module scripts, has run: on
 * `DOMContentLoaded`, or on the next task when the document already finished loading.
 */
export function onDomReady(win: DevtoolsWindow, callback: () => void): void {
  if (win.document.readyState === 'complete') {
    win.setTimeout(callback, 0);
    return;
  }
  win.document.addEventListener('DOMContentLoaded', () => callback(), { once: true });
}

/** Reports an error like an uncaught exception, without interrupting the caller. */
export function reportError(win: DevtoolsWindow, error: unknown): void {
  if (typeof win.reportError === 'function') {
    win.reportError(error);
    return;
  }
  win.setTimeout(() => {
    throw error;
  }, 0);
}

/**
 * Calls the global function `name` with `args`, the way SignalRGB calls handlers. Returns whether
 * the global was a function. What it throws is reported, not rethrown.
 */
export function callGlobal(win: DevtoolsWindow, name: string, ...args: unknown[]): boolean {
  const handler = globalsOf(win)[name];
  if (typeof handler !== 'function') return false;
  try {
    handler.apply(win, args);
  } catch (error) {
    reportError(win, error);
  }
  return true;
}
```

`packages/srgb-effect-kit/src/devtools/storage.ts`:
```ts
/** First segment of every key: `srgb-effect-kit:<title>:<key>`. */
export const STORAGE_PREFIX = 'srgb-effect-kit';

/** localStorage scoped to one effect. Every call tolerates missing, blocked or full storage. */
export interface DevtoolsStorage {
  /** `srgb-effect-kit:<title>:` */
  readonly prefix: string;
  /** The stored JSON value, or undefined when it is missing, unparsable or fails `isValid`. */
  read<T>(key: string, isValid: (value: unknown) => value is T): T | undefined;
  /** Stores `value` as JSON. Failures (quota, blocked storage) are ignored. */
  write(key: string, value: unknown): void;
  remove(key: string): void;
}

/** Storage that keeps nothing: every read is undefined, every write is dropped. */
export const NO_STORAGE: DevtoolsStorage = {
  prefix: '',
  read: () => undefined,
  write: () => {},
  remove: () => {},
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Namespaces keys by effect title, because every effect served from `localhost:5173` shares one
 * origin and therefore one localStorage.
 */
export function createStorage(
  title: string,
  getStorage: () => Storage | undefined,
): DevtoolsStorage {
  const prefix = `${STORAGE_PREFIX}:${title}:`;
  const storage = (): Storage | undefined => {
    try {
      return getStorage();
    } catch {
      // Accessing localStorage throws when the browser blocks site data.
      return undefined;
    }
  };
  return {
    prefix,
    read<T>(key: string, isValid: (value: unknown) => value is T): T | undefined {
      let raw: string | null | undefined;
      try {
        raw = storage()?.getItem(prefix + key);
      } catch {
        return undefined;
      }
      if (raw === null || raw === undefined) return undefined;
      try {
        const value: unknown = JSON.parse(raw);
        return isValid(value) ? value : undefined;
      } catch {
        return undefined;
      }
    },
    write(key, value) {
      try {
        storage()?.setItem(prefix + key, JSON.stringify(value));
      } catch {
        // Quota exceeded or storage blocked: the setting just doesn't persist.
      }
    },
    remove(key) {
      try {
        storage()?.removeItem(prefix + key);
      } catch {
        // Storage blocked: nothing to remove.
      }
    },
  };
}
```

`packages/srgb-effect-kit/src/devtools/engine.ts`:
```ts
import { FREQUENCY_BINS } from '../runtime/audio';
import type { SRGBEngine } from '../runtime/globals';
import { ZONE_COLUMNS, ZONE_ROWS } from '../runtime/zones';
import type { MeterDef } from '../shared';

/** `engine.audio` with a mutable `freq` array. */
export interface MockAudio {
  level: number;
  width: number;
  density: number;
  freq: number[];
}

/** `engine.zone` with mutable 560-entry arrays. */
export interface MockZone {
  hue: number[];
  saturation: number[];
  lightness: number[];
}

/** The dev-mode `engine` global. The devtools mutate it in place, so cached references stay live. */
export interface MockEngine extends SRGBEngine {
  audio: MockAudio;
  zone: MockZone;
  vision: SRGBVision & Record<string, number>;
}

/** A meter's value before anything is measured: -1 (no reading) for `ocr_numeric`, else 0. */
export const initialMeterValue = (meter: MeterDef): number =>
  meter.type === 'ocr_numeric' ? -1 : 0;

/** Silent audio, a black screen and every meter at its initial value. */
export function createEngineMock(meters: readonly MeterDef[] = []): MockEngine {
  const cells = ZONE_COLUMNS * ZONE_ROWS;
  return {
    audio: {
      level: -100,
      width: 0,
      density: 0,
      freq: new Array<number>(FREQUENCY_BINS).fill(0),
    },
    zone: {
      hue: new Array<number>(cells).fill(0),
      saturation: new Array<number>(cells).fill(0),
      lightness: new Array<number>(cells).fill(0),
    },
    vision: Object.fromEntries(
      meters.map((meter) => [meter.meter, initialMeterValue(meter)]),
    ) as SRGBVision & Record<string, number>,
  };
}
```

`packages/srgb-effect-kit/src/devtools/properties.ts`:
```ts
import { handlerName, type PropertyDef } from '../shared';
import { globalsOf, type DevtoolsWindow } from './context';
import { callGlobal } from './lifecycle';
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
    for (const listener of listeners) listener(p.property, value);
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
```

`packages/srgb-effect-kit/src/devtools/simulation.ts`. Task 2's minimal entry shares it with the full entry:
```ts
import { handlerGlobalNames, type DevtoolsConfig } from '../shared';
import { globalsOf, type DevtoolsWindow, type SimulationContext } from './context';
import { createEngineMock } from './engine';
import { onDomReady } from './lifecycle';
import { createPropertyController } from './properties';
import type { DevtoolsStorage } from './storage';

const INSTANCE = Symbol.for('srgb-effect-kit.devtools');

/** The context a previous `startDevtools()` stored on this window, if any. */
export const findInstance = <T extends SimulationContext>(win: DevtoolsWindow): T | undefined =>
  (win as unknown as Record<symbol, T | undefined>)[INSTANCE];

/** Remembers the context so a second start (e.g. a re-executed module) reuses it. */
export function rememberInstance(win: DevtoolsWindow, context: SimulationContext): void {
  (win as unknown as Record<symbol, SimulationContext>)[INSTANCE] = context;
}

/**
 * Sets up SignalRGB's environment, synchronously: the handler globals (the build's prelude
 * guarantee), the property globals (from `storage`, else the defaults) and the `engine` mock. On
 * DOM ready, calls every `on<Prop>Changed` when `fireChangedOnLoad` is set.
 */
export function startSimulation(
  config: DevtoolsConfig,
  win: DevtoolsWindow,
  storage: DevtoolsStorage,
): SimulationContext {
  const globals = globalsOf(win);
  // Bare `onSpeedChanged = …` must not throw in strict code.
  for (const name of handlerGlobalNames(config.manifest)) {
    if (!(name in win)) globals[name] = undefined;
  }
  const properties = createPropertyController(config.manifest.properties ?? [], storage, win);
  const engine = createEngineMock(config.manifest.meters);
  globals.engine = engine;

  // DOMContentLoaded fires after every module script ran, so effect code has assigned its handlers.
  onDomReady(win, () => {
    if (config.fireChangedOnLoad) properties.fireAll();
  });
  return { config, win, properties, engine };
}
```

`packages/srgb-effect-kit/src/devtools/index.ts`:
```ts
import type { DevtoolsConfig } from '../shared';
import type { DevtoolsContext, FrameScheduler, StartOptions } from './context';
import { findInstance, rememberInstance, startSimulation } from './simulation';
import { createStorage } from './storage';

export type { DevtoolsContext, StartOptions } from './context';

/**
 * Entry for `devtools: 'full'` (the default). The plugin's virtual module imports and calls it
 * from a module script that runs before the effect's own scripts. Everything before the DOM-ready
 * callbacks runs synchronously, so the effect's top-level code already sees SignalRGB's globals.
 */
export function startDevtools(config: DevtoolsConfig, options: StartOptions = {}): DevtoolsContext {
  const { win = window } = options;
  const existing = findInstance<DevtoolsContext>(win);
  if (existing) return existing;

  const storage = createStorage(config.manifest.title, () => win.localStorage);
  const raf: FrameScheduler = {
    request: win.requestAnimationFrame.bind(win),
    cancel: win.cancelAnimationFrame.bind(win),
  };
  const simulation = startSimulation(config, win, storage);

  const context: DevtoolsContext = { ...simulation, storage, raf };
  rememberInstance(win, context);
  return context;
}
```

- [ ] **Step 5: Run the tests and checks**

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools src/shared && pnpm --filter srgb-effect-kit typecheck && pnpm lint && pnpm format`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js packages/srgb-effect-kit/src/shared packages/srgb-effect-kit/src/devtools packages/srgb-effect-kit/test/helpers/devtools.ts
git commit -m "feat(devtools): define SignalRGB globals and fire change handlers in dev" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 2: Vite integration: devtools modes, minimal entry, virtual module, canvas event endpoint

**Files:**
- Create:
  - `packages/srgb-effect-kit/src/devtools/canvasApi.ts`
  - `packages/srgb-effect-kit/src/devtools/minimal.ts`
  - `packages/srgb-effect-kit/src/vite/devtoolsEntry.ts`
  - `packages/srgb-effect-kit/src/vite/devtoolsPlugin.ts`
- Modify:
  - `packages/srgb-effect-kit/src/devtools/{context,simulation,index}.ts`
  - `packages/srgb-effect-kit/src/devtools/index.test.ts`
  - `packages/srgb-effect-kit/src/vite/options.ts`, `packages/srgb-effect-kit/src/vite/options.test.ts`
  - `packages/srgb-effect-kit/src/vite/index.ts`, `packages/srgb-effect-kit/src/vite/index.test-d.ts`
  - `packages/srgb-effect-kit/tsdown.config.ts`
- Test:
  - `packages/srgb-effect-kit/src/devtools/{canvasApi,minimal}.test.ts`
  - `packages/srgb-effect-kit/src/vite/devtoolsEntry.test.ts`
  - `packages/srgb-effect-kit/test/devtoolsPlugin.test.ts`

**Interfaces:**
- Consumes:
  - From Task 1: `CANVAS_EVENT`, `CANVAS_EVENT_PATH`, `DEVTOOLS_MODULE_ID`, `DevtoolsConfig`, `callGlobal`, `startSimulation`, `findInstance`, `rememberInstance`, `NO_STORAGE`, `StartOptions`, `SimulationContext`.
  - From the runtime: `CanvasApiEvent`.
- Produces:
  - **`vite/options.ts`** (replaces the boolean option; the package is pre-release):
    - `type DevtoolsMode = 'none' | 'minimal' | 'full'`
    - `interface DevtoolsOptions { mode?: DevtoolsMode; fireChangedOnLoad?: boolean }`
    - `SrgbEffectOptions.devtools?: DevtoolsMode | DevtoolsOptions`, with a default of `'full'`
    - `ResolvedOptions.devtools: Required<DevtoolsOptions>`. A string means `{ mode, fireChangedOnLoad: true }`. Anything else throws `[srgb-effect] devtools must be 'none', 'minimal', 'full' or { mode, fireChangedOnLoad } (got …)`.
    - `srgb-effect-kit/vite` also exports `type DevtoolsMode`.
  - **`devtools/canvasApi.ts`:**
    - `type CanvasEventSource = 'drawer' | 'http'`
    - `interface CanvasEventRecord extends CanvasApiEvent { source; handled; time }`
    - `CANVAS_HISTORY_LIMIT = 20`
    - `toCanvasApiEvent(data): CanvasApiEvent | undefined`
    - `interface CanvasApiController { history; dispatch(event, source): boolean; subscribe }`
    - `createCanvasApi(win, now?)`
    - `SimulationContext` gains `canvasApi`. `startSimulation(config, win, storage, hot?)` relays `CANVAS_EVENT`.
  - **`devtools/minimal.ts`:** the minimal-mode entry. `startDevtools(config, options?): SimulationContext` is `startSimulation` with `NO_STORAGE`, plus the double-start guard.
  - **`vite/devtoolsEntry.ts`:**
    - `type DevtoolsEntryMode = 'minimal' | 'full'`
    - `resolveDevtoolsEntry(mode, from = import.meta.url): string`. It looks for `../devtools/{minimal|index}.js`, then `.ts`, and throws `[srgb-effect] devtools bundle "<name>" not found …` if neither exists.
  - **`vite/devtoolsPlugin.ts`:**
    - `DEVTOOLS_MODULE_URL = '/@id/__x00__virtual:srgb-effect/devtools'`
    - `devtoolsModuleCode(entry, config): string`
    - `canvasEventMiddleware(send): Connect.NextHandleFunction`
    - `devtoolsPlugin(manifest, { mode: DevtoolsEntryMode; fireChangedOnLoad }, entry?): Plugin`. The plugin is named `srgb-effect:devtools` and applies only in serve.
  - **`srgbEffect()`** adds `devtoolsPlugin` unless the mode is `'none'`.
  - **tsdown** writes `dist/devtools/index.js` and `dist/devtools/minimal.js`, each self-contained.

How the minimal mode avoids loading the UI: it is a separate entry, built by its own tsdown config. `minimal.ts` imports only `simulation.ts`, which imports `properties`, `engine`, `canvasApi`, `lifecycle`, `storage` and shared. Nothing in that graph imports `ui/`, `renderer`, `consoleCounter`, `audioController` or `screenController`. The plugin serves `minimal.js` in `'minimal'` mode and `index.js` in `'full'` mode. Step 4 checks the minimal bundle's contents, and the Task 3 e2e test checks which file the browser requests.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/devtools/canvasApi.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDevtoolsWindow } from '../../test/helpers/devtools';
import { CANVAS_HISTORY_LIMIT, createCanvasApi, toCanvasApiEvent } from './canvasApi';

beforeEach(() => {
  resetDevtoolsWindow();
  vi.stubGlobal('reportError', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('toCanvasApiEvent', () => {
  it('accepts objects with string sender and event only', () => {
    expect(toCanvasApiEvent({ sender: 'a', event: 'b', extra: 1 })).toEqual({
      sender: 'a',
      event: 'b',
    });
    expect(toCanvasApiEvent({ sender: 'a' })).toBeUndefined();
    expect(toCanvasApiEvent({ sender: 1, event: 'b' })).toBeUndefined();
    expect(toCanvasApiEvent('a')).toBeUndefined();
    expect(toCanvasApiEvent(null)).toBeUndefined();
  });
});

describe('createCanvasApi', () => {
  it('calls onCanvasApiEvent with { sender, event } and records the event', () => {
    const api = createCanvasApi(window, () => 1000);
    const handler = vi.fn();
    window.onCanvasApiEvent = handler;
    const listener = vi.fn();
    api.subscribe(listener);

    expect(api.dispatch({ sender: 'game', event: 'hit' }, 'http')).toBe(true);
    expect(handler).toHaveBeenCalledWith({ sender: 'game', event: 'hit' });
    expect(api.history).toEqual([
      { sender: 'game', event: 'hit', source: 'http', handled: true, time: 1000 },
    ]);
    expect(listener).toHaveBeenCalledWith(api.history);
  });

  it('records unhandled events and reports handler errors', () => {
    const api = createCanvasApi(window);
    expect(api.dispatch({ sender: 's', event: 'e' }, 'drawer')).toBe(false);
    expect(api.history[0]?.handled).toBe(false);

    const error = new Error('handler failed');
    window.onCanvasApiEvent = () => {
      throw error;
    };
    expect(api.dispatch({ sender: 's', event: 'e' }, 'drawer')).toBe(true);
    expect(window.reportError).toHaveBeenCalledWith(error);
  });

  it('keeps the newest events first, up to the limit', () => {
    const api = createCanvasApi(window);
    for (let i = 0; i < CANVAS_HISTORY_LIMIT + 5; i += 1) {
      api.dispatch({ sender: 's', event: String(i) }, 'drawer');
    }
    expect(api.history).toHaveLength(CANVAS_HISTORY_LIMIT);
    expect(api.history[0]?.event).toBe(String(CANVAS_HISTORY_LIMIT + 4));
  });
});
```

`packages/srgb-effect-kit/src/devtools/minimal.test.ts`:
```ts
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
```

In `packages/srgb-effect-kit/src/devtools/index.test.ts`, replace:

Replace:

```ts
  it('returns the existing context when started twice', () => {
```

with:

```ts
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

  it('returns the existing context when started twice', () => {
```

Replace `packages/srgb-effect-kit/src/vite/options.test.ts` with:
```ts
import { describe, expect, it } from 'vitest';
import { resolveOptions } from './options';

describe('resolveOptions', () => {
  it('applies defaults and splits manifest from plugin options', () => {
    expect(resolveOptions({ title: 'Hue Cycle', publisher: 'me' })).toEqual({
      manifest: { title: 'Hue Cycle', publisher: 'me' },
      typesFile: 'src/srgb-effect.d.ts',
      fileName: 'hue-cycle.html',
      script: 'module',
      dropConsole: true,
      target: 'es2020',
      devtools: { mode: 'full', fireChangedOnLoad: true },
    });
  });

  it('defaults script to module', () => {
    expect(resolveOptions({ title: 'X' }).script).toBe('module');
    expect(resolveOptions({ title: 'X', script: 'classic' }).script).toBe('classic');
  });

  it('respects overrides', () => {
    const resolved = resolveOptions({
      title: 'X',
      typesFile: 'types/effect.d.ts',
      fileName: 'custom.html',
      script: 'classic',
      dropConsole: false,
      target: ['chrome100', 'safari15'],
      devtools: { mode: 'minimal', fireChangedOnLoad: false },
    });
    expect(resolved).toMatchObject({
      typesFile: 'types/effect.d.ts',
      fileName: 'custom.html',
      script: 'classic',
      dropConsole: false,
      target: ['chrome100', 'safari15'],
      devtools: { mode: 'minimal', fireChangedOnLoad: false },
    });
  });

  it('resolves the devtools mode from a string or the object form', () => {
    expect(resolveOptions({ title: 'X', devtools: 'none' }).devtools).toEqual({
      mode: 'none',
      fireChangedOnLoad: true,
    });
    expect(resolveOptions({ title: 'X', devtools: 'minimal' }).devtools).toEqual({
      mode: 'minimal',
      fireChangedOnLoad: true,
    });
    expect(resolveOptions({ title: 'X', devtools: {} }).devtools).toEqual({
      mode: 'full',
      fireChangedOnLoad: true,
    });
    expect(resolveOptions({ title: 'X', devtools: { fireChangedOnLoad: false } }).devtools).toEqual(
      { mode: 'full', fireChangedOnLoad: false },
    );
  });

  it('rejects the old boolean form and unknown modes', () => {
    for (const devtools of [
      true,
      false,
      'off',
      { mode: 'max' },
      { fireChangedOnLoad: 'yes' },
      null,
    ]) {
      expect(() => resolveOptions({ title: 'X', devtools } as never)).toThrow(
        /\[srgb-effect\] devtools must be 'none', 'minimal', 'full' or \{ mode, fireChangedOnLoad \}/,
      );
    }
  });

  it('rejects file names that are not plain .html files', () => {
    expect(() => resolveOptions({ title: 'X', fileName: 'out/x.html' })).toThrow(
      /fileName must be a plain file name/,
    );
    expect(() => resolveOptions({ title: 'X', fileName: 'x.htm' })).toThrow(
      /fileName must be a plain file name/,
    );
  });
});
```

Append to `packages/srgb-effect-kit/src/vite/index.test-d.ts`:
```ts

srgbEffect({ title: 'X', devtools: 'minimal' });
srgbEffect({ title: 'X', devtools: { mode: 'none', fireChangedOnLoad: false } });
// @ts-expect-error the boolean form was replaced by modes
srgbEffect({ title: 'X', devtools: false });
```

`packages/srgb-effect-kit/src/vite/devtoolsEntry.test.ts`:
```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveDevtoolsEntry } from './devtoolsEntry';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** Creates `files` under a temp package root and returns the URL of `<root>/<from>`. */
const layout = (files: string[], from: string) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'srgb-devtools-entry-'));
  dirs.push(root);
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '');
  }
  return { root, url: pathToFileURL(path.join(root, from)).href };
};

describe('resolveDevtoolsEntry', () => {
  it('finds each mode’s built bundle next to the built plugin', () => {
    const { root, url } = layout(
      ['dist/vite/index.js', 'dist/devtools/index.js', 'dist/devtools/minimal.js'],
      'dist/vite/index.js',
    );
    expect(resolveDevtoolsEntry('full', url)).toBe(path.join(root, 'dist/devtools/index.js'));
    expect(resolveDevtoolsEntry('minimal', url)).toBe(path.join(root, 'dist/devtools/minimal.js'));
  });

  it('falls back to the TypeScript source when running from source', () => {
    const { root, url } = layout(
      ['src/vite/devtoolsEntry.ts', 'src/devtools/index.ts', 'src/devtools/minimal.ts'],
      'src/vite/devtoolsEntry.ts',
    );
    expect(resolveDevtoolsEntry('full', url)).toBe(path.join(root, 'src/devtools/index.ts'));
    expect(resolveDevtoolsEntry('minimal', url)).toBe(path.join(root, 'src/devtools/minimal.ts'));
  });

  it('throws a clear error when the bundle is missing', () => {
    const { url } = layout(['dist/vite/index.js', 'dist/devtools/index.js'], 'dist/vite/index.js');
    expect(() => resolveDevtoolsEntry('minimal', url)).toThrow(
      /\[srgb-effect\] devtools bundle "minimal" not found/,
    );
  });

  it('resolves the source entries from this module by default', () => {
    expect(resolveDevtoolsEntry('full')).toBe(
      path.resolve(import.meta.dirname, '../devtools/index.ts'),
    );
    expect(resolveDevtoolsEntry('minimal')).toBe(
      path.resolve(import.meta.dirname, '../devtools/minimal.ts'),
    );
  });
});
```

`packages/srgb-effect-kit/test/devtoolsPlugin.test.ts`. It runs the plugin from source, so the virtual module imports `src/devtools/{index,minimal}.ts` through `/@fs/`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { createServer, type InlineConfig, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { srgbEffect } from '../src/vite';
import { buildFixture, cleanupFixtures, createFixture } from './helpers/fixture';

const options = {
  title: 'Devtools Plugin',
  properties: [{ property: 'speed', type: 'number', label: 'Speed', min: 0, max: 10, default: 5 }],
} as const;

const INDEX =
  '<!doctype html><html><head></head><body><script type="module" src="/main.js"></script></body></html>';

const servers: ViteDevServer[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  cleanupFixtures();
});

const serve = async (config: InlineConfig = {}, listen = false) => {
  const root = createFixture({ 'index.html': INDEX, 'main.js': 'window.started = true;' });
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: listen
      ? { host: '127.0.0.1', port: 0, ws: false }
      : { middlewareMode: true, ws: false },
    plugins: [srgbEffect(options)],
    ...config,
  });
  servers.push(server);
  if (listen) await server.listen();
  const html = await server.transformIndexHtml(
    '/index.html',
    fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
  );
  return { server, html, url: server.resolvedUrls?.local[0] ?? '' };
};

const TAG = '<script type="module" src="/@id/__x00__virtual:srgb-effect/devtools"></script>';

describe('devtools plugin', () => {
  it('injects the devtools module script before the effect script', async () => {
    const { html } = await serve();
    expect(html).toContain(TAG);
    expect(html.indexOf(TAG)).toBeLessThan(html.indexOf('src="/main.js"'));
  });

  it('prefixes the script URL with a custom base', async () => {
    const { html } = await serve({ base: '/sub/' });
    expect(html).toContain('src="/sub/@id/__x00__virtual:srgb-effect/devtools"');
  });

  it('serves a virtual module that starts the devtools with the manifest', async () => {
    const { server } = await serve();
    const result = await server.transformRequest('virtual:srgb-effect/devtools');
    expect(result?.code).toMatch(
      /import \{ startDevtools \} from "\/@fs\/[^"]*\/src\/devtools\/index\.ts"/,
    );
    expect(result?.code).toContain('"title":"Devtools Plugin"');
    expect(result?.code).toContain('"fireChangedOnLoad":true');
  });

  it('passes fireChangedOnLoad: false through', async () => {
    const root = createFixture({ 'index.html': INDEX });
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      plugins: [srgbEffect({ ...options, devtools: { fireChangedOnLoad: false } })],
    });
    servers.push(server);
    const result = await server.transformRequest('virtual:srgb-effect/devtools');
    expect(result?.code).toContain('"fireChangedOnLoad":false');
  });

  it('relays POST /canvas/event to the page over the WebSocket', async () => {
    const { server, url } = await serve({}, true);
    const send = vi.spyOn(server.ws, 'send');
    const response = await fetch(new URL('/canvas/event?sender=my%20game&event=hit', url), {
      method: 'POST',
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(send).toHaveBeenCalledWith('srgb-effect:canvas-event', {
      sender: 'my game',
      event: 'hit',
    });

    await fetch(new URL('/canvas/event', url), { method: 'POST' });
    expect(send).toHaveBeenLastCalledWith('srgb-effect:canvas-event', { sender: '', event: '' });
  });

  it('rejects methods other than POST', async () => {
    const { server, url } = await serve({}, true);
    const send = vi.spyOn(server.ws, 'send');
    const get = await fetch(new URL('/canvas/event?sender=a&event=b', url));
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the endpoint at /canvas/event under a custom base', async () => {
    const { server, url } = await serve({ base: '/sub/' }, true);
    const send = vi.spyOn(server.ws, 'send');
    const response = await fetch(new URL('/canvas/event?sender=a&event=b', url), {
      method: 'POST',
    });
    expect(response.status).toBe(204);
    expect(send).toHaveBeenCalledOnce();
  });

  it('loads the small minimal entry in minimal mode', async () => {
    const { server, html } = await serve({
      plugins: [srgbEffect({ ...options, devtools: 'minimal' })],
    });
    expect(html).toContain(TAG);
    const result = await server.transformRequest('virtual:srgb-effect/devtools');
    expect(result?.code).toMatch(/from "\/@fs\/[^"]*\/src\/devtools\/minimal\.ts"/);
    expect(result?.code).toContain('"fireChangedOnLoad":true');
  });

  it("injects nothing with devtools: 'none'", async () => {
    const { server, html, url } = await serve(
      { plugins: [srgbEffect({ ...options, devtools: 'none' })] },
      true,
    );
    expect(html).not.toContain('srgb-effect/devtools');
    expect(html).not.toMatch(/onSpeedChanged|engine/);
    await expect(server.transformRequest('virtual:srgb-effect/devtools')).rejects.toThrow();
    const response = await fetch(new URL('/canvas/event', url), { method: 'POST' });
    expect(response.status).toBe(404);
  });

  it('leaves no devtools code in the build', async () => {
    const root = createFixture({ 'index.html': INDEX, 'main.js': 'window.started = speed;' });
    const { files } = await buildFixture(root, { plugins: [srgbEffect(options)] });
    const html = files.get('devtools-plugin.html') ?? '';
    expect(html).toContain('<title>Devtools Plugin</title>');
    expect(html).not.toMatch(/srgb-effect\/devtools|startDevtools|srgb-effect-kit:/);
  });
});
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools src/vite test/devtoolsPlugin.test.ts`
Expected: FAIL. The following cannot be resolved: `./canvasApi`, `./minimal` and `./devtoolsEntry`. The options tests fail on `mode`, and the plugin tests find no devtools tag.

- [ ] **Step 2: Add the canvas API module, the relay and the minimal entry**

`packages/srgb-effect-kit/src/devtools/canvasApi.ts`:
```ts
import type { CanvasApiEvent } from '../runtime/globals';
import type { DevtoolsWindow } from './context';
import { callGlobal } from './lifecycle';

/** Where a canvas API event came from: the drawer's form or `POST /canvas/event` on the dev server. */
export type CanvasEventSource = 'drawer' | 'http';

/** One dispatched event, as listed in the Canvas API tab. */
export interface CanvasEventRecord extends CanvasApiEvent {
  source: CanvasEventSource;
  /** Whether `window.onCanvasApiEvent` was a function when the event arrived. */
  handled: boolean;
  /** `Date.now()` at dispatch. */
  time: number;
}

/** Number of events the history keeps. */
export const CANVAS_HISTORY_LIMIT = 20;

/** Validates a WebSocket payload: an object with string `sender` and `event`. */
export function toCanvasApiEvent(data: unknown): CanvasApiEvent | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const { sender, event } = data as Record<string, unknown>;
  return typeof sender === 'string' && typeof event === 'string' ? { sender, event } : undefined;
}

/** Delivers canvas API events to the effect and remembers the latest ones. */
export interface CanvasApiController {
  /** Newest first, at most `CANVAS_HISTORY_LIMIT` entries. */
  readonly history: readonly CanvasEventRecord[];
  /** Calls `window.onCanvasApiEvent({ sender, event })`. Returns whether a handler existed. */
  dispatch(event: CanvasApiEvent, source: CanvasEventSource): boolean;
  subscribe(listener: (history: readonly CanvasEventRecord[]) => void): () => void;
}

export function createCanvasApi(
  win: DevtoolsWindow,
  now: () => number = () => Date.now(),
): CanvasApiController {
  let history: CanvasEventRecord[] = [];
  const listeners = new Set<(history: readonly CanvasEventRecord[]) => void>();
  return {
    get history() {
      return history;
    },
    dispatch({ sender, event }, source) {
      // A fresh object per call, like a real request; the handler may keep or mutate it.
      const handled = callGlobal(win, 'onCanvasApiEvent', { sender, event });
      history = [{ sender, event, source, handled, time: now() }, ...history].slice(
        0,
        CANVAS_HISTORY_LIMIT,
      );
      for (const listener of listeners) listener(history);
      return handled;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

In `packages/srgb-effect-kit/src/devtools/context.ts`, make these replacements:

1. Replace:

```ts
import type { DevtoolsConfig } from '../shared';
```

with:

```ts
import type { DevtoolsConfig } from '../shared';
import type { CanvasApiController } from './canvasApi';
```

2. Replace:

```ts
  readonly engine: MockEngine;
}
```

with:

```ts
  readonly engine: MockEngine;
  readonly canvasApi: CanvasApiController;
}
```

In `packages/srgb-effect-kit/src/devtools/simulation.ts`, make these replacements:

1. Replace:

```ts
import { handlerGlobalNames, type DevtoolsConfig } from '../shared';
import { globalsOf, type DevtoolsWindow, type SimulationContext } from './context';
```

with:

```ts
import { CANVAS_EVENT, handlerGlobalNames, type DevtoolsConfig } from '../shared';
import { createCanvasApi, toCanvasApiEvent } from './canvasApi';
import { globalsOf, type DevtoolsWindow, type HotBridge, type SimulationContext } from './context';
```

2. Replace:

```ts
 * guarantee), the property globals (from `storage`, else the defaults) and the `engine` mock. On
 * DOM ready, calls every `on<Prop>Changed` when `fireChangedOnLoad` is set.
```

with:

```ts
 * guarantee), the property globals (from `storage`, else the defaults), the `engine` mock and the
 * canvas-event relay. On DOM ready, calls every `on<Prop>Changed` when `fireChangedOnLoad` is set.
```

3. Replace:

```ts
  storage: DevtoolsStorage,
): SimulationContext {
```

with:

```ts
  storage: DevtoolsStorage,
  hot?: HotBridge,
): SimulationContext {
```

4. Replace:

```ts
  globals.engine = engine;

  // DOMContentLoaded
```

with:

```ts
  globals.engine = engine;
  const canvasApi = createCanvasApi(win);

  // `POST /canvas/event` on the dev server arrives over Vite's WebSocket.
  hot?.on(CANVAS_EVENT, (data) => {
    const event = toCanvasApiEvent(data);
    if (event) canvasApi.dispatch(event, 'http');
  });
  // DOMContentLoaded
```

5. Replace:

```ts
  return { config, win, properties, engine };
```

with:

```ts
  return { config, win, properties, engine, canvasApi };
```

In `packages/srgb-effect-kit/src/devtools/index.ts`, make these replacements:

1. Replace:

```ts
  const { win = window } = options;
```

with:

```ts
  const { hot, win = window } = options;
```

2. Replace:

```ts
  const simulation = startSimulation(config, win, storage);
```

with:

```ts
  const simulation = startSimulation(config, win, storage, hot);
```

`packages/srgb-effect-kit/src/devtools/minimal.ts`:
```ts
import type { DevtoolsConfig } from '../shared';
import type { SimulationContext, StartOptions } from './context';
import { findInstance, rememberInstance, startSimulation } from './simulation';
import { NO_STORAGE } from './storage';

export type { SimulationContext, StartOptions } from './context';

/**
 * Entry for `devtools: 'minimal'`: SignalRGB's environment and nothing visible. Property globals
 * always start from the manifest defaults (nothing is persisted, as nothing can change them), the
 * renderer stays the browser's, and no drawer, marker or console counter is loaded.
 */
export function startDevtools(
  config: DevtoolsConfig,
  options: StartOptions = {},
): SimulationContext {
  const { hot, win = window } = options;
  const existing = findInstance(win);
  if (existing) return existing;
  const context = startSimulation(config, win, NO_STORAGE, hot);
  rememberInstance(win, context);
  return context;
}
```

- [ ] **Step 3: Replace the boolean option with modes, and add the entry resolver and the plugin**

Replace `packages/srgb-effect-kit/src/vite/options.ts` with:
```ts
import { kebabCase, type EffectManifest } from '../shared';

/**
 * How much of SignalRGB `vite` dev simulates:
 * - `'none'`: nothing; the page is served as is.
 * - `'minimal'`: SignalRGB's environment only (handler and property globals at their defaults,
 *   the `engine` mock, load-time handler calls, `POST /canvas/event`), with nothing visible.
 * - `'full'`: the minimal environment plus the devtools drawer and its simulations.
 */
export type DevtoolsMode = 'none' | 'minimal' | 'full';

/** Object form of the `devtools` option. */
export interface DevtoolsOptions {
  /** @default 'full' */
  mode?: DevtoolsMode;
  /** Call every on<Prop>Changed once at load, like SignalRGB does. @default true */
  fireChangedOnLoad?: boolean;
}

const DEVTOOLS_MODES: readonly DevtoolsMode[] = ['none', 'minimal', 'full'];

/** Options for `srgbEffect()`: the effect manifest plus build settings. */
export interface SrgbEffectOptions extends EffectManifest {
  /**
   * Generated globals typings, relative to the Vite root. Generated on every `vite` and `vite build`; add it to `.gitignore`.
   * @default 'src/srgb-effect.d.ts'
   */
  typesFile?: string;
  /**
   * Output file name: a plain name ending in `.html`, without directories.
   * @default kebab-cased title + '.html'
   */
  fileName?: string;
  /**
   * `'module'` (the default) emits one inline `<script type="module">`, which allows external
   * imports, top-level await and `import.meta`. `'classic'` is opt-in for engines that cannot run
   * module scripts: it bundles the effect as a strict-mode IIFE in a plain `<script>` and rejects
   * those three features.
   * @default 'module'
   */
  script?: 'classic' | 'module';
  /**
   * Strip `console.*` and `debugger` from the build (SignalRGB requires a clean console). Also
   * minifies the script, even with `build.minify: false`. @default true
   */
  dropConsole?: boolean;
  /** Build target. Provisional until probed. @default 'es2020' */
  target?: string | string[];
  /**
   * SignalRGB simulation in `vite` dev, never part of the build: a mode (`'none'`, `'minimal'` or
   * `'full'`, see {@link DevtoolsMode}) or `{ mode, fireChangedOnLoad }`. A string means
   * `{ mode, fireChangedOnLoad: true }`. @default 'full'
   */
  devtools?: DevtoolsMode | DevtoolsOptions;
}

/** `SrgbEffectOptions` with defaults applied, split into the manifest and plugin settings. */
export interface ResolvedOptions {
  manifest: EffectManifest;
  typesFile: string;
  fileName: string;
  script: 'classic' | 'module';
  dropConsole: boolean;
  target: string | string[];
  devtools: Required<DevtoolsOptions>;
}

/** Resolves the `devtools` option, rejecting anything but a mode or the object form. */
function resolveDevtools(devtools: unknown): Required<DevtoolsOptions> {
  const options: unknown = typeof devtools === 'string' ? { mode: devtools } : devtools;
  if (typeof options === 'object' && options !== null) {
    const { mode = 'full', fireChangedOnLoad = true } = options as DevtoolsOptions;
    if (DEVTOOLS_MODES.includes(mode) && typeof fireChangedOnLoad === 'boolean') {
      return { mode, fireChangedOnLoad };
    }
  }
  throw new Error(
    `[srgb-effect] devtools must be 'none', 'minimal', 'full' or { mode, fireChangedOnLoad } (got ${JSON.stringify(devtools)})`,
  );
}

/**
 * Applies defaults and splits plugin settings from the manifest.
 * @throws Error when `fileName` does not end in `.html` or contains a path separator, or when
 * `devtools` is not a mode or `{ mode?, fireChangedOnLoad? }` (for example the old `true`/`false`).
 */
export function resolveOptions(options: SrgbEffectOptions): ResolvedOptions {
  const {
    typesFile = 'src/srgb-effect.d.ts',
    fileName,
    script = 'module',
    dropConsole = true,
    target = 'es2020',
    devtools = 'full',
    ...manifest
  } = options;

  const resolvedFileName = fileName ?? `${kebabCase(manifest.title)}.html`;
  if (!resolvedFileName.endsWith('.html') || /[\\/]/.test(resolvedFileName)) {
    throw new Error(
      `[srgb-effect] fileName must be a plain file name ending in .html (got "${resolvedFileName}")`,
    );
  }

  return {
    manifest,
    typesFile,
    fileName: resolvedFileName,
    script,
    dropConsole,
    target,
    devtools: resolveDevtools(devtools),
  };
}
```

`packages/srgb-effect-kit/src/vite/devtoolsEntry.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Devtools modes that load a bundle: `'minimal'` (the environment only) or `'full'`. */
export type DevtoolsEntryMode = 'minimal' | 'full';

/** File name of each mode's entry, in dist/devtools and in src/devtools. */
const ENTRY_NAMES: Record<DevtoolsEntryMode, string> = { minimal: 'minimal', full: 'index' };

/**
 * Absolute path of a devtools entry, relative to this module: the built bundle
 * (dist/vite → dist/devtools/<name>.js) when the plugin runs from the package, then the TypeScript
 * source (src/vite → src/devtools/<name>.ts) when it runs from source, as in this repository's tests.
 * @param mode - `'minimal'` loads `minimal`, `'full'` loads `index`.
 * @param from - URL of the module to resolve from. @default import.meta.url
 * @throws Error when neither file exists.
 */
export function resolveDevtoolsEntry(
  mode: DevtoolsEntryMode,
  from: string = import.meta.url,
): string {
  const dir = path.dirname(fileURLToPath(from));
  const name = ENTRY_NAMES[mode];
  for (const extension of ['.js', '.ts']) {
    const file = path.resolve(dir, '../devtools', name + extension);
    if (fs.existsSync(file)) return file;
  }
  throw new Error(
    `[srgb-effect] devtools bundle "${name}" not found next to ${dir}. Reinstall srgb-effect-kit, or set devtools: 'none'.`,
  );
}
```

`packages/srgb-effect-kit/src/vite/devtoolsPlugin.ts`:
```ts
import { normalizePath, type Connect, type Plugin } from 'vite';
import {
  CANVAS_EVENT,
  CANVAS_EVENT_PATH,
  DEVTOOLS_MODULE_ID,
  type DevtoolsConfig,
  type EffectManifest,
} from '../shared';
import { resolveDevtoolsEntry, type DevtoolsEntryMode } from './devtoolsEntry';

const RESOLVED_ID = `\0${DEVTOOLS_MODULE_ID}`;

/**
 * Root-relative URL of the virtual module. Vite prefixes `base` when it processes the injected
 * tag, so the URL must not include it.
 */
export const DEVTOOLS_MODULE_URL = `/@id/__x00__${DEVTOOLS_MODULE_ID}`;

/** Source of the virtual module: imports the devtools entry and starts it with the config. */
export function devtoolsModuleCode(entry: string, config: DevtoolsConfig): string {
  return [
    `import { startDevtools } from ${JSON.stringify(normalizePath(entry))};`,
    `startDevtools(${JSON.stringify(config)}, { hot: import.meta.hot });`,
    '',
  ].join('\n');
}

/**
 * Mirrors SignalRGB's `POST /canvas/event?sender=…&event=…` on the dev server. Missing parameters
 * are sent as empty strings. Answers 204 with `Access-Control-Allow-Origin: *`, so pages on other
 * origins can post too (Vite's own CORS middleware runs first and answers preflights), and 405 for
 * other methods. Other paths go to `next()`.
 */
export function canvasEventMiddleware(
  send: (event: { sender: string; event: string }) => void,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== CANVAS_EVENT_PATH) {
      next();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      res.end();
      return;
    }
    send({
      sender: url.searchParams.get('sender') ?? '',
      event: url.searchParams.get('event') ?? '',
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 204;
    res.end();
  };
}

/**
 * Serve-only plugin that injects the devtools entry for `mode` before the effect's scripts and
 * relays canvas API events. `entry` overrides the entry module path (tests).
 */
export function devtoolsPlugin(
  manifest: EffectManifest,
  options: { mode: DevtoolsEntryMode; fireChangedOnLoad: boolean },
  entry?: string,
): Plugin {
  const config: DevtoolsConfig = { manifest, fireChangedOnLoad: options.fireChangedOnLoad };
  let resolvedEntry = entry;
  return {
    name: 'srgb-effect:devtools',
    apply: 'serve',
    configResolved() {
      // Fail at startup, not on the first page load, when the bundle is missing.
      resolvedEntry ??= resolveDevtoolsEntry(options.mode);
    },
    resolveId(id) {
      return id === DEVTOOLS_MODULE_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      return devtoolsModuleCode(resolvedEntry ?? resolveDevtoolsEntry(options.mode), config);
    },
    configureServer(server) {
      // Registered before Vite's own middlewares, so the path matches whatever `base` is.
      server.middlewares.use(canvasEventMiddleware((event) => server.ws.send(CANVAS_EVENT, event)));
    },
    transformIndexHtml: {
      order: 'pre',
      // Module scripts run in document order, so a head-prepended one runs before the effect's.
      handler: () => [
        {
          tag: 'script',
          attrs: { type: 'module', src: DEVTOOLS_MODULE_URL },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}
```

How each bundle path resolves:
- **Built package** (examples via `workspace:*`, consumers via `node_modules`, butterchurn via a `file:` tarball): `dist/vite/index.js` → `dist/devtools/{index,minimal}.js`.
- **Source** (this repo's vitest): `src/vite/devtoolsEntry.ts` → `src/devtools/{index,minimal}.ts`, which Vite transpiles on the fly.

In both cases, Vite rewrites the virtual module's absolute import to `/@fs/<path>`. It serves that path even outside `server.fs.allow`, because it records resolved import ids as safe module paths.

In `packages/srgb-effect-kit/src/vite/index.ts`, make these replacements:

1. Replace:

```ts
import { corePlugin } from './corePlugin';
```

with:

```ts
import { corePlugin } from './corePlugin';
import { devtoolsPlugin } from './devtoolsPlugin';
```

2. Replace:

```ts
export type { DevtoolsOptions, ResolvedOptions, SrgbEffectOptions } from './options';
```

with:

```ts
export type { DevtoolsMode, DevtoolsOptions, ResolvedOptions, SrgbEffectOptions } from './options';
```

3. Replace:

```ts
 * `index.html`, warns about module-scoped change handlers, and makes `vite build` emit one
 * self-contained HTML file.
```

with:

```ts
 * `index.html`, warns about module-scoped change handlers, simulates SignalRGB in `vite` dev with
 * the devtools, and makes `vite build` emit one self-contained HTML file.
```

4. Replace:

```ts
  return [corePlugin(resolved), buildPlugin(resolved), moduleScopePlugin(resolved)];
```

with:

```ts
  const plugins = [corePlugin(resolved), buildPlugin(resolved), moduleScopePlugin(resolved)];
  const { mode, fireChangedOnLoad } = resolved.devtools;
  if (mode !== 'none') plugins.push(devtoolsPlugin(resolved.manifest, { mode, fireChangedOnLoad }));
  return plugins;
```

- [ ] **Step 4: Build both devtools bundles**

In `packages/srgb-effect-kit/tsdown.config.ts`, replace:

Replace:

```ts
  {
    entry: { 'vite/index': 'src/vite/index.ts' },
```

with:

```ts
  // Internal entries, served to the browser by the plugin in dev and never exported. Separate
  // configs keep each bundle self-contained, so 'minimal' never loads the drawer's code.
  {
    entry: { 'devtools/index': 'src/devtools/index.ts' },
    platform: 'browser',
    format: 'esm',
    dts: false,
    fixedExtension: false,
    clean: false,
  },
  {
    entry: { 'devtools/minimal': 'src/devtools/minimal.ts' },
    platform: 'browser',
    format: 'esm',
    dts: false,
    fixedExtension: false,
    clean: false,
  },
  {
    entry: { 'vite/index': 'src/vite/index.ts' },
```

Run:

```bash
pnpm --filter srgb-effect-kit build
cd packages/srgb-effect-kit
ls -l dist/devtools
for f in dist/devtools/*.js; do
  echo "$f imports=$(grep -c '^import' $f) host=$(grep -c 'srgb-effect-devtools' $f) css=$(grep -c ':host' $f) ua=$(grep -c 'Ultralight/' $f)"
done
cd ../..
```

Expected:
- Both bundles exist. `minimal.js` is about 9 KB; `index.js` grows with later tasks, to about 77 KB by Task 11.
- Both report `imports=0`.
- `minimal.js` reports `host=0 css=0 ua=0`, now and after every later task.

- [ ] **Step 5: Run the tests and checks**

Run: `pnpm --filter srgb-effect-kit test && pnpm --filter srgb-effect-kit typecheck && pnpm lint && pnpm format`
Expected: all PASS.

- [ ] **Step 6: Check it in a browser**

Run: `pnpm --filter @srgb-effect-kit-examples/basic-2d dev`, then open the printed URL.
Expected:
- the rainbow animates, and the console shows no `ReferenceError`;
- `window.speed` is `25`;
- `curl -X POST "http://localhost:5173/canvas/event?sender=a&event=b"` (use the printed port) answers `204`.

Then set `devtools: 'minimal'` in `examples/basic-2d/vite.config.ts` and restart. The page behaves the same, and the Network panel shows `minimal.js` instead of `index.js`. Revert the config.

- [ ] **Step 7: Commit**

```bash
git add packages/srgb-effect-kit
git commit -m "feat(vite): add devtools modes and inject the dev simulation" -m "devtools is now 'none' | 'minimal' | 'full' (or { mode, fireChangedOnLoad }); 'minimal' loads a separate bundle without any UI." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 3: End-to-end harness (Playwright + Chromium) and CI job

**Files:**
- Modify: `package.json` (root), `eslint.config.js`, `.gitignore`, `.github/workflows/ci.yml`, `pnpm-lock.yaml`
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/devtools.spec.ts`, `e2e/tsconfig.json`
- Create: `e2e/fixtures/modes/vite.config.mjs`, `e2e/fixtures/modes/index.html`, `e2e/fixtures/modes/main.js`

**Interfaces:**
- Consumes:
  - From Tasks 1–2: the globals in dev, the load-time handler calls, and `POST /canvas/event`.
  - `examples/basic-2d`, unchanged, which runs in the default `'full'` mode. It declares `speed` (number, default 25), `baseHue` (hue, 200), `rainbow` (boolean, true) and `mode` (list `Wave`/`Pulse`). It assigns only `window.onBaseHueChanged`, and reads `baseHue` at its top level.
  - From Task 2: the devtools modes, and the `dist/devtools/minimal.js` bundle.
- Produces:
  - **Root scripts:** `pnpm test:e2e` (`playwright test`). `pnpm typecheck` also type-checks `e2e/`.
  - **`e2e/helpers.ts`:**
    - `recordHandlerCalls(page, names)` → `window.__handlerCalls`
    - `probeGlobalsAtUserStart(page, names)` → `window.__atUserStart`
    - `collectPageErrors(page)`
    - `openEffect(page, url = '/')`
    - `MODE_PORTS = { minimal: 5311, none: 5312 }`
  - **`e2e/fixtures/modes/`:** a one-property effect (`speed`, default 5). Its `vite.config.mjs` loads the **built** plugin by relative path and reads the mode from `SRGB_DEVTOOLS_MODE`. Playwright serves it twice, in `'minimal'` and `'none'` mode, with the `vite` binary of `basic-2d`. The fixture is not a workspace package.
  - **`e2e/devtools.spec.ts`:** later tasks append tests to it.
  - **CI job `e2e`**.

- [ ] **Step 1: Add Playwright and the scripts**

Run: `pnpm add -Dw @playwright/test@^1.64.1 @types/node@^26.6.5`

Then make the root `package.json` `scripts` read:

```json
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:e2e": "playwright test",
    "typecheck": "pnpm -r typecheck && tsc -p e2e",
    "lint": "eslint .",
    "format": "prettier --check .",
    "format:fix": "prettier --write ."
  },
```

Append to `.gitignore`:

```text
test-results
playwright-report
```

In `eslint.config.js`, replace:

Replace:

```js
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts', '**/*.generated.ts'] },
```

with:

```js
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/*.generated.ts',
      'test-results/**',
      'playwright-report/**',
    ],
  },
```

- [ ] **Step 2: Write the Playwright config and helpers**

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test';
import { MODE_PORTS } from './e2e/helpers';

/** Port of the basic-2d dev server (devtools 'full') the end-to-end tests drive. */
const PORT = 5310;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Shared dev servers: run serially so tests never race on a server's WebSocket broadcasts.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    browserName: 'chromium',
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 800 },
    // Locally, CHROMIUM_PATH can point at a system Chromium instead of Playwright's download.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Serves the example against the built package (packages/srgb-effect-kit/dist): build first.
      command: `pnpm --dir examples/basic-2d exec vite --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    // The same small fixture in the 'minimal' and 'none' devtools modes. Vite comes from basic-2d.
    ...(['minimal', 'none'] as const).map((mode) => ({
      command: `pnpm --dir examples/basic-2d exec vite --config ../../e2e/fixtures/modes/vite.config.mjs --host 127.0.0.1 --port ${MODE_PORTS[mode]} --strictPort`,
      url: `http://127.0.0.1:${MODE_PORTS[mode]}/`,
      env: { SRGB_DEVTOOLS_MODE: mode },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    })),
  ],
});
```

`e2e/tsconfig.json`. The generated `srgb-effect.d.ts` of `basic-2d` types `window.speed` and the other globals in `page.evaluate` callbacks. It exists after `pnpm build` or `pnpm dev`, and CI runs the build before the typecheck. The fixture is excluded, because its own generated `.d.ts` would declare a second `speed`.
```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"]
  },
  "include": ["**/*.ts", "../playwright.config.ts", "../examples/basic-2d/src/srgb-effect.d.ts"],
  "exclude": ["fixtures"]
}
```

`e2e/helpers.ts`:
```ts
import type { Page } from '@playwright/test';

declare global {
  interface Window {
    /** Handler names in call order, recorded by `recordHandlerCalls`. */
    __handlerCalls: string[];
    /** `typeof` of SignalRGB globals at the first line of the effect's main module. */
    __atUserStart: Record<string, string | boolean>;
    /** Canvas API events the test's handler received. */
    __events: unknown[];
    /** Calls of the modes fixture's `onSpeedChanged`. */
    __speedCalls: number;
  }
}

/** Ports of the e2e/fixtures/modes dev servers, one per devtools mode ('full' is basic-2d). */
export const MODE_PORTS = { minimal: 5311, none: 5312 } as const;

/**
 * Records every call of the named handlers, whoever assigns them. The getter/setter pair defined
 * before any page script runs wraps each function the effect assigns.
 */
export async function recordHandlerCalls(page: Page, names: string[]): Promise<void> {
  await page.addInitScript((handlerNames: string[]) => {
    const calls: string[] = [];
    window.__handlerCalls = calls;
    for (const name of handlerNames) {
      let current: unknown;
      Object.defineProperty(window, name, {
        configurable: true,
        get: () => current,
        set: (value: unknown) => {
          current =
            typeof value === 'function'
              ? function (this: unknown, ...args: unknown[]) {
                  calls.push(name);
                  return (value as (...a: unknown[]) => unknown).apply(this, args);
                }
              : value;
        },
      });
    }
  }, names);
}

/**
 * Prepends a probe to the effect's `src/main.ts` that records which SignalRGB globals exist when
 * the module's own code starts.
 */
export async function probeGlobalsAtUserStart(page: Page, names: string[]): Promise<void> {
  await page.route('**/src/main.ts', async (route) => {
    const response = await route.fetch();
    const probe = `window.__atUserStart = { ${names
      .map((name) => `${name}: typeof window.${name}`)
      .join(', ')}, onSpeedChanged: 'onSpeedChanged' in window };\n`;
    await route.fulfill({ response, body: probe + (await response.text()) });
  });
}

/** Collects uncaught page errors. */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/**
 * Opens the effect and waits for the load event (the devtools fire the load-time handlers and mount
 * the drawer on DOMContentLoaded, before it) and for Vite's WebSocket, which relays canvas events.
 */
export async function openEffect(page: Page, url = '/'): Promise<void> {
  const connected = page.waitForEvent('console', (message) =>
    message.text().includes('[vite] connected'),
  );
  await page.goto(url);
  await connected;
}
```

`e2e/fixtures/modes/vite.config.mjs`:
```js
// Serves this fixture with the devtools mode from SRGB_DEVTOOLS_MODE ('none' or 'minimal'). It
// loads the built plugin directly, so run `pnpm build` first.
import { srgbEffect } from '../../../packages/srgb-effect-kit/dist/vite/index.js';

export default {
  root: import.meta.dirname,
  logLevel: 'warn',
  plugins: [
    srgbEffect({
      title: 'Modes Fixture',
      properties: [
        { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 10, default: 5 },
      ],
      devtools: process.env.SRGB_DEVTOOLS_MODE,
    }),
  ],
};
```

`e2e/fixtures/modes/index.html`:
```
<!doctype html>
<html>
  <head></head>
  <body>
    <script type="module" src="/main.js"></script>
  </body>
</html>
```

`e2e/fixtures/modes/main.js`. It reads the globals through `window`, so it runs in `'none'` mode too:
```js
// Reads globals through `window`, so it also runs when nothing defines them ('none').
window.__atUserStart = {
  speed: typeof window.speed,
  engine: typeof window.engine,
  onSpeedChanged: 'onSpeedChanged' in window,
};
window.__speedCalls = 0;
window.onSpeedChanged = () => {
  window.__speedCalls += 1;
};
window.__events = [];
window.onCanvasApiEvent = (event) => window.__events.push(event);
```

Running the fixture writes `e2e/fixtures/modes/src/srgb-effect.d.ts`. The existing `srgb-effect.d.ts` pattern in `.gitignore` already ignores it.

- [ ] **Step 3: Write the end-to-end tests for Tasks 1–2, including the three modes**

`e2e/devtools.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  collectPageErrors,
  MODE_PORTS,
  openEffect,
  probeGlobalsAtUserStart,
  recordHandlerCalls,
} from './helpers';

const EXAMPLE = path.resolve(import.meta.dirname, '../examples/basic-2d');

test('defines SignalRGB globals before the effect code runs', async ({ page }) => {
  const errors = collectPageErrors(page);
  await probeGlobalsAtUserStart(page, ['speed', 'baseHue', 'rainbow', 'mode', 'engine']);
  await openEffect(page);
  expect(await page.evaluate(() => window.__atUserStart)).toEqual({
    speed: 'number',
    baseHue: 'number',
    rainbow: 'string',
    mode: 'string',
    engine: 'object',
    onSpeedChanged: true,
  });
  expect(errors).toEqual([]);
});

test('calls the assigned change handlers once on load', async ({ page }) => {
  await recordHandlerCalls(page, [
    'onSpeedChanged',
    'onBaseHueChanged',
    'onRainbowChanged',
    'onModeChanged',
  ]);
  await openEffect(page);
  // basic-2d assigns only onBaseHueChanged.
  await expect.poll(() => page.evaluate(() => window.__handlerCalls)).toEqual(['onBaseHueChanged']);
});

test('relays POST /canvas/event into onCanvasApiEvent', async ({ page }) => {
  await openEffect(page);
  await page.evaluate(() => {
    window.__events = [];
    window.onCanvasApiEvent = (event) => void window.__events.push(event);
  });
  const response = await page.request.post('/canvas/event?sender=e2e&event=hit%20me');
  expect(response.status()).toBe(204);
  await expect
    .poll(() => page.evaluate(() => window.__events))
    .toEqual([{ sender: 'e2e', event: 'hit me' }]);
});

test('leaves no devtools code in the build output', () => {
  execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], { cwd: EXAMPLE });
  const html = fs.readFileSync(path.join(EXAMPLE, 'dist/basic-2d.html'), 'utf8');
  expect(html).toContain('<title>Basic 2D</title>');
  for (const marker of [
    'srgb-effect-devtools',
    'srgb-effect/devtools',
    'srgb-effect-kit:',
    '@id/',
  ]) {
    expect(html).not.toContain(marker);
  }
});

test("devtools 'minimal' simulates SignalRGB without loading any devtools UI", async ({ page }) => {
  const origin = `http://127.0.0.1:${MODE_PORTS.minimal}`;
  const errors = collectPageErrors(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  // Minimal mode ignores stored values: the globals always start at the defaults.
  await page.addInitScript(() =>
    localStorage.setItem('srgb-effect-kit:Modes Fixture:properties', JSON.stringify({ speed: 9 })),
  );
  await openEffect(page, `${origin}/`);
  expect(await page.evaluate(() => window.__atUserStart)).toEqual({
    speed: 'number',
    engine: 'object',
    onSpeedChanged: true,
  });
  await expect.poll(() => page.evaluate(() => window.__speedCalls)).toBe(1);
  expect(await page.evaluate(() => window.speed)).toBe(5);
  await expect(page.locator('srgb-effect-devtools')).toHaveCount(0);
  expect(requests.some((url) => url.includes('/devtools/minimal.js'))).toBe(true);
  expect(requests.some((url) => url.includes('/devtools/index.js'))).toBe(false);

  const response = await page.request.post(`${origin}/canvas/event?sender=e2e&event=ping`);
  expect(response.status()).toBe(204);
  await expect
    .poll(() => page.evaluate(() => window.__events))
    .toEqual([{ sender: 'e2e', event: 'ping' }]);
  expect(errors).toEqual([]);
});

test("devtools 'none' injects nothing", async ({ page }) => {
  const origin = `http://127.0.0.1:${MODE_PORTS.none}`;
  await openEffect(page, `${origin}/`);
  expect(await page.evaluate(() => window.__atUserStart)).toEqual({
    speed: 'undefined',
    engine: 'undefined',
    onSpeedChanged: false,
  });
  await expect(page.locator('srgb-effect-devtools')).toHaveCount(0);
  const response = await page.request.post(`${origin}/canvas/event?sender=e2e&event=ping`);
  expect(response.status()).toBe(404);
});
```

- [ ] **Step 4: Run them**

Run: `pnpm build && CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e`. Without a system Chromium, run `pnpm exec playwright install chromium` once, then `pnpm test:e2e`.
Expected: 6 passed. Playwright starts three dev servers, on ports 5310, 5311 and 5312.

To confirm the tests catch regressions:
1. Temporarily change `head-prepend` to `body` in `devtoolsPlugin.ts`, run `pnpm build && pnpm test:e2e`, and see the first test fail. Revert the change.
2. Temporarily map `minimal` to `'index'` in `ENTRY_NAMES` in `devtoolsEntry.ts`, rebuild, and see the `'minimal'` test fail on the bundle requests. Revert the change and rebuild.

- [ ] **Step 5: Add the CI job**

In `.github/workflows/ci.yml`, keep the `ci` job and add a second job under `jobs:`:

```yaml
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 26.2.0
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      # The examples run against the built package (dist/), so build first.
      - run: pnpm build
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces
          path: test-results/
```

- [ ] **Step 6: Run the full pipeline**

Run: `pnpm lint && pnpm format && pnpm build && pnpm typecheck && pnpm test`
Expected: all PASS. `pnpm typecheck` now also runs `tsc -p e2e`.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml .gitignore eslint.config.js .github/workflows/ci.yml playwright.config.ts e2e
git commit -m "test: add Playwright end-to-end tests for the dev globals and devtools modes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 4: Audio, screen-zone and meter math

**Files:**
- Create: `packages/srgb-effect-kit/src/devtools/{audio,zones,meters}.ts`
- Test: `packages/srgb-effect-kit/src/devtools/{audio,zones,meters}.test.ts`

**Interfaces:**
- Consumes:
  - From Task 1: `MockAudio`, `MockZone`, `createEngineMock`.
  - From the runtime: `FREQUENCY_BINS`, `isSilent`, `getZone`, `ZONE_COLUMNS`, `ZONE_ROWS`, `hexToRgb`, `lerpColor`, `rgbToHsl`.
  - From shared: `MeterDef`, `LinearMeter`, `AreaMeter`, `Range`.
- Produces:
  - **`audio.ts`:**
    - `interface AudioFrame { level; width; density; freq: ArrayLike<number> }`
    - `MIN_LEVEL`
    - `writeAudioFrame(target, frame)`, `silentFrame()`, `randomFrame(random?)`
    - `rms(samples)`, `levelFromSamples(samples)`, `stereoWidth(left, right)`, `spectralFlatness(spectrum, bins?)`
    - `interface AnalyserReadings { left; right; spectrum; mono }`
    - `analyserFrame(readings)`
  - **`zones.ts`:**
    - `ZONE_COUNT`
    - `fillSolidZones(zone, hex)`, `fillGradientZones(zone, from, to)`
    - `sampleZones(zone, pixels, width, height)`
  - **`meters.ts`:**
    - `type HslMeter`, `isHslMeter(m)`
    - `interface MeterRegion`, `interface PixelRect`
    - `resolveMeterRegion(meter, screenWidth, screenHeight)`
    - `toPixelRect(region, linear, width, height)`
    - `evaluateHslMeter(meter, pixels, width, rect)`
    - `clampMeterValue(meter, value)`

These modules have no DOM dependency. They fix the dev-mode semantics:
- **Audio:**
  - `level` is the RMS in dB of the mixed channels, clamped to −100..0.
  - `width` is side/(mid+side) RMS.
  - `density` is spectral flatness.
  - `freq` holds 200 byte bands.
- **Zones:** HSL on the meters' scale (hue 0–360, saturation and lightness 0–100). This is provisional until the probe.
- **Meter resolution overrides:** an exact `size` wins, then an `aspect` within 3%.
- **`hdr` ranges** are not simulated.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/devtools/audio.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { isSilent } from '../runtime/audio';
import {
  analyserFrame,
  levelFromSamples,
  randomFrame,
  rms,
  silentFrame,
  spectralFlatness,
  stereoWidth,
  writeAudioFrame,
} from './audio';
import { createEngineMock } from './engine';

/** Deterministic generator for reproducible frames. */
const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const sine = (length: number, amplitude: number, phase = 0) =>
  Array.from({ length }, (_, i) => amplitude * Math.sin((i / 16) * Math.PI + phase));

describe('audio frames', () => {
  it('writes frames in place, keeping the freq array', () => {
    const { audio } = createEngineMock();
    const freq = audio.freq;
    writeAudioFrame(audio, { level: -20, width: 0.5, density: 0.25, freq: [1, 2, 3] });
    expect(audio.freq).toBe(freq);
    expect(audio).toMatchObject({ level: -20, width: 0.5, density: 0.25 });
    expect(audio.freq.slice(0, 4)).toEqual([1, 2, 3, 0]);
    expect(audio.freq).toHaveLength(200);
  });

  it('silent frames read as silence', () => {
    expect(isSilent(silentFrame())).toBe(true);
    expect(silentFrame()).toMatchObject({ level: -100, width: 0, density: 0 });
  });

  it('random frames stay in range and never read as silence', () => {
    const random = seeded(42);
    for (let i = 0; i < 50; i += 1) {
      const frame = randomFrame(random);
      expect(frame.level).toBeGreaterThanOrEqual(-60);
      expect(frame.level).toBeLessThanOrEqual(0);
      expect(frame.width).toBeGreaterThanOrEqual(0);
      expect(frame.width).toBeLessThanOrEqual(1);
      expect(frame.density).toBeGreaterThanOrEqual(0);
      expect(frame.density).toBeLessThanOrEqual(1);
      expect(frame.freq).toHaveLength(200);
      for (const band of Array.from(frame.freq)) {
        expect(band).toBeGreaterThanOrEqual(0);
        expect(band).toBeLessThanOrEqual(255);
      }
      expect(isSilent(frame)).toBe(false);
    }
  });
});

describe('audio analysis', () => {
  it('computes RMS and dB levels clamped to -100..0', () => {
    expect(rms([])).toBe(0);
    expect(rms([1, -1])).toBe(1);
    expect(levelFromSamples([1, -1])).toBe(0);
    expect(levelFromSamples(new Array(8).fill(0.1))).toBeCloseTo(-20, 5);
    expect(levelFromSamples(new Array(8).fill(0))).toBe(-100);
    expect(levelFromSamples(new Array(8).fill(1e-9))).toBe(-100);
    expect(levelFromSamples(new Array(8).fill(4))).toBe(0);
  });

  it('measures stereo width from mid and side energy', () => {
    const left = sine(256, 0.5);
    expect(stereoWidth(left, left)).toBe(0);
    expect(
      stereoWidth(
        left,
        left.map((v) => -v),
      ),
    ).toBe(1);
    const random = seeded(7);
    const noiseL = Array.from({ length: 4096 }, () => random() * 2 - 1);
    const noiseR = Array.from({ length: 4096 }, () => random() * 2 - 1);
    expect(stereoWidth(noiseL, noiseR)).toBeGreaterThan(0.4);
    expect(stereoWidth(noiseL, noiseR)).toBeLessThan(0.6);
    expect(stereoWidth([0, 0], [0, 0])).toBe(0);
  });

  it('measures density as spectral flatness', () => {
    expect(spectralFlatness(new Array(200).fill(120))).toBeCloseTo(1, 5);
    const tone = new Array(200).fill(0);
    tone[20] = 255;
    expect(spectralFlatness(tone)).toBeLessThan(0.1);
    expect(spectralFlatness(new Array(200).fill(0))).toBe(0);
    expect(spectralFlatness([])).toBe(0);
  });

  it('builds frames from analyser readings', () => {
    const left = sine(512, 0.5);
    const spectrum = Array.from({ length: 256 }, (_, i) => (i < 200 ? 100 : 255));
    const stereo = analyserFrame({ left, right: left, spectrum, mono: false });
    expect(stereo.level).toBeCloseTo(20 * Math.log10(0.5 / Math.SQRT2), 1);
    expect(stereo.width).toBe(0);
    expect(stereo.density).toBeCloseTo(1, 5);
    expect(Array.from(stereo.freq)).toEqual(new Array(200).fill(100));

    const mono = analyserFrame({ left, right: new Array(512).fill(0), spectrum, mono: true });
    expect(mono.width).toBe(0);
    expect(mono.level).toBeCloseTo(stereo.level, 5);
  });
});
```

`packages/srgb-effect-kit/src/devtools/zones.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { getZone } from '../runtime/zones';
import { createEngineMock } from './engine';
import { fillGradientZones, fillSolidZones, sampleZones, ZONE_COUNT } from './zones';

/** RGBA pixels where `color(x, y)` gives each pixel's RGB. */
const image = (width: number, height: number, color: (x: number, y: number) => number[]) => {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) pixels.set([...color(x, y), 255], (y * width + x) * 4);
  }
  return pixels;
};

describe('zone simulation', () => {
  it('fills every cell with a solid color', () => {
    const { zone } = createEngineMock();
    fillSolidZones(zone, '#ff0000');
    expect(zone.hue).toHaveLength(ZONE_COUNT);
    expect(getZone(0, 0, zone)).toEqual({ h: 0, s: 100, l: 50 });
    expect(getZone(27, 19, zone)).toEqual({ h: 0, s: 100, l: 50 });
  });

  it('fills a left-to-right gradient', () => {
    const { zone } = createEngineMock();
    fillGradientZones(zone, '#000000', '#ffffff');
    expect(getZone(0, 5, zone).l).toBe(0);
    expect(getZone(27, 5, zone).l).toBe(100);
    expect(getZone(13, 0, zone)).toEqual(getZone(13, 19, zone));
    expect(getZone(13, 0, zone).l).toBeGreaterThan(40);
    expect(getZone(13, 0, zone).l).toBeLessThan(60);
  });

  it('averages captured pixels per cell', () => {
    const { zone } = createEngineMock();
    // Left half red, right half blue, on a 56×40 frame (2×2 pixels per cell).
    sampleZones(
      zone,
      image(56, 40, (x) => (x < 28 ? [255, 0, 0] : [0, 0, 255])),
      56,
      40,
    );
    expect(getZone(0, 0, zone)).toEqual({ h: 0, s: 100, l: 50 });
    expect(getZone(13, 19, zone)).toEqual({ h: 0, s: 100, l: 50 });
    expect(getZone(14, 0, zone)).toEqual({ h: 240, s: 100, l: 50 });
  });

  it('averages mixed pixels and handles frames smaller than the grid', () => {
    const { zone } = createEngineMock();
    // Alternating black and white columns average to mid grey.
    sampleZones(
      zone,
      image(56, 40, (x) => (x % 2 ? [255, 255, 255] : [0, 0, 0])),
      56,
      40,
    );
    expect(getZone(3, 3, zone).l).toBe(50);

    sampleZones(
      zone,
      image(4, 2, () => [0, 255, 0]),
      4,
      2,
    );
    expect(getZone(27, 19, zone)).toEqual({ h: 120, s: 100, l: 50 });
  });
});
```

`packages/srgb-effect-kit/src/devtools/meters.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { MANIFEST } from '../../test/helpers/devtools';
import {
  clampMeterValue,
  evaluateHslMeter,
  isHslMeter,
  resolveMeterRegion,
  toPixelRect,
} from './meters';

const [health, mana, victory, score] = MANIFEST.meters;

describe('meter regions', () => {
  it('uses the meter region when no resolution matches', () => {
    expect(resolveMeterRegion(health, 1280, 720)).toEqual({
      x: 0.1,
      y: 0.5,
      width: 0.5,
      height: 0,
    });
    expect(resolveMeterRegion(mana, 1280, 720)).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
  });

  it('merges an exact size override', () => {
    expect(resolveMeterRegion(mana, 1920, 1080)).toEqual({
      x: 0.5,
      y: 0,
      width: 0.5,
      height: 0.5,
    });
  });

  it('matches aspect overrides within 3%, after exact sizes', () => {
    const meter = {
      ...mana,
      resolutions: [
        { aspect: '21:9', x: 0.25 },
        { size: '2560x1080', x: 0.4 },
      ],
    } as const;
    expect(resolveMeterRegion(meter, 2560, 1080).x).toBe(0.4);
    expect(resolveMeterRegion(meter, 3440, 1440).x).toBe(0.25);
    expect(resolveMeterRegion(meter, 1920, 1080).x).toBe(0);
  });

  it('converts regions to pixel rects inside the frame', () => {
    expect(toPixelRect({ x: 0.1, y: 0.5, width: 0.5, height: 0 }, true, 100, 50)).toEqual({
      x: 10,
      y: 25,
      width: 50,
      height: 1,
    });
    expect(toPixelRect({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 }, false, 100, 50)).toEqual({
      x: 90,
      y: 45,
      width: 10,
      height: 5,
    });
    expect(toPixelRect({ x: 1, y: 1, width: 0, height: 0 }, false, 10, 10)).toEqual({
      x: 9,
      y: 9,
      width: 1,
      height: 1,
    });
  });
});

describe('evaluateHslMeter', () => {
  it('returns the fraction of pixels inside the HSL ranges', () => {
    // 4×1 frame: two green pixels (h 120) inside health's ranges, one red, one grey.
    const pixels = new Uint8ClampedArray([
      0, 255, 0, 255, 0, 200, 0, 255, 255, 0, 0, 255, 128, 128, 128, 255,
    ]);
    expect(evaluateHslMeter(health, pixels, 4, { x: 0, y: 0, width: 4, height: 1 })).toBe(0.5);
    expect(evaluateHslMeter(health, pixels, 4, { x: 0, y: 0, width: 2, height: 1 })).toBe(1);
    expect(evaluateHslMeter(health, pixels, 4, { x: 0, y: 0, width: 0, height: 1 })).toBe(0);
  });

  it('only applies to linear and area meters', () => {
    expect(MANIFEST.meters.map(isHslMeter)).toEqual([true, true, false, false]);
  });
});

describe('clampMeterValue', () => {
  it('limits manual values to what each meter type reports', () => {
    expect(clampMeterValue(health, 1.5)).toBe(1);
    expect(clampMeterValue(mana, -1)).toBe(0);
    expect(clampMeterValue(mana, Number.NaN)).toBe(0);
    expect(clampMeterValue(victory, 0.6)).toBe(1);
    expect(clampMeterValue(victory, -7)).toBe(-1);
    expect(clampMeterValue(victory, Number.NaN)).toBe(0);
    expect(clampMeterValue(score, 41.6)).toBe(42);
    expect(clampMeterValue(score, -5)).toBe(-1);
    expect(clampMeterValue(score, Number.POSITIVE_INFINITY)).toBe(-1);
  });
});
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools/audio.test.ts src/devtools/zones.test.ts src/devtools/meters.test.ts`
Expected: FAIL, because the modules cannot be resolved.

- [ ] **Step 2: Implement**

`packages/srgb-effect-kit/src/devtools/audio.ts`:
```ts
import { FREQUENCY_BINS } from '../runtime/audio';
import type { MockAudio } from './engine';

/** One `engine.audio` update. */
export interface AudioFrame {
  /** dB, -100..0 */
  level: number;
  /** 0..1 */
  width: number;
  /** 0..1 */
  density: number;
  /** At least 200 bands; extra bands are ignored. */
  freq: ArrayLike<number>;
}

/** Quietest level SignalRGB reports. */
export const MIN_LEVEL = -100;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Copies `frame` into `target` in place, keeping `target.freq`'s identity. Missing bands become 0. */
export function writeAudioFrame(target: MockAudio, frame: AudioFrame): void {
  target.level = frame.level;
  target.width = frame.width;
  target.density = frame.density;
  for (let i = 0; i < FREQUENCY_BINS; i += 1) target.freq[i] = frame.freq[i] ?? 0;
}

/** No audio: level -100, everything else 0. */
export const silentFrame = (): AudioFrame => ({
  level: MIN_LEVEL,
  width: 0,
  density: 0,
  freq: new Array<number>(FREQUENCY_BINS).fill(0),
});

/**
 * Plausible noise that `isSilent()` never treats as silence: level -60..0 dB, width and density
 * 0..1, and bands 0..255 that fall off towards high frequencies.
 */
export function randomFrame(random: () => number = Math.random): AudioFrame {
  return {
    level: -60 + random() * 60,
    width: random(),
    density: random(),
    freq: Array.from({ length: FREQUENCY_BINS }, (_, i) =>
      Math.round(random() * 255 * (1 - i / (2 * FREQUENCY_BINS))),
    ),
  };
}

/** Root mean square of `samples`; 0 when empty. */
export function rms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i]! ** 2;
  return Math.sqrt(sum / samples.length);
}

/** Loudness in dB of samples in -1..1, clamped to -100..0. */
export function levelFromSamples(samples: ArrayLike<number>): number {
  const value = rms(samples);
  return value > 0 ? Math.min(0, Math.max(MIN_LEVEL, 20 * Math.log10(value))) : MIN_LEVEL;
}

/**
 * Stereo width 0..1 from the side (L−R) and mid (L+R) energy: 0 for mono, about 0.5 for
 * uncorrelated channels, 1 for channels in opposite phase. 0 for silence.
 */
export function stereoWidth(left: ArrayLike<number>, right: ArrayLike<number>): number {
  const length = Math.min(left.length, right.length);
  let mid = 0;
  let side = 0;
  for (let i = 0; i < length; i += 1) {
    mid += ((left[i]! + right[i]!) / 2) ** 2;
    side += ((left[i]! - right[i]!) / 2) ** 2;
  }
  const total = Math.sqrt(mid) + Math.sqrt(side);
  return total > 0 ? clamp01(Math.sqrt(side) / total) : 0;
}

/**
 * Spectral flatness 0..1 of the first `bins` bands: geometric over arithmetic mean, with bands
 * floored at 1/10000 of the loudest so empty bands don't collapse it. Near 0 for a pure tone, 1 for
 * a flat (white noise) spectrum, 0 when every band is 0.
 */
export function spectralFlatness(spectrum: ArrayLike<number>, bins = FREQUENCY_BINS): number {
  const length = Math.min(bins, spectrum.length);
  let max = 0;
  for (let i = 0; i < length; i += 1) max = Math.max(max, spectrum[i]!);
  if (max <= 0) return 0;
  const floor = max * 1e-4;
  let logSum = 0;
  let sum = 0;
  for (let i = 0; i < length; i += 1) {
    const value = Math.max(floor, spectrum[i]!);
    logSum += Math.log(value);
    sum += value;
  }
  return clamp01(Math.exp(logSum / length) / (sum / length));
}

/** Analyser readings for one frame of captured audio. */
export interface AnalyserReadings {
  /** Time-domain samples, -1..1. */
  left: ArrayLike<number>;
  right: ArrayLike<number>;
  /** Byte frequency data (0..255) of the mixed signal. */
  spectrum: ArrayLike<number>;
  /** The source has one channel: width is 0 and level comes from `left` alone. */
  mono: boolean;
}

/** Turns analyser readings into an `engine.audio` frame. */
export function analyserFrame({ left, right, spectrum, mono }: AnalyserReadings): AudioFrame {
  const length = Math.min(left.length, right.length);
  const mixed = mono ? left : Array.from({ length }, (_, i) => (left[i]! + right[i]!) / 2);
  return {
    level: levelFromSamples(mixed),
    width: mono ? 0 : stereoWidth(left, right),
    density: spectralFlatness(spectrum),
    freq: Array.from({ length: FREQUENCY_BINS }, (_, i) => spectrum[i] ?? 0),
  };
}
```

`packages/srgb-effect-kit/src/devtools/zones.ts`:
```ts
import { hexToRgb, lerpColor, rgbToHsl, type Hsl, type Rgb } from '../runtime/color';
import { ZONE_COLUMNS, ZONE_ROWS } from '../runtime/zones';
import type { MockZone } from './engine';

/** Cells in the 28×20 grid. */
export const ZONE_COUNT = ZONE_COLUMNS * ZONE_ROWS;

const write = (zone: MockZone, index: number, { h, s, l }: Hsl) => {
  zone.hue[index] = h;
  zone.saturation[index] = s;
  zone.lightness[index] = l;
};

/**
 * Fills every cell with one color. Zone values use the meters' scale: hue 0–360, saturation and
 * lightness 0–100 (provisional until probed on SignalRGB).
 */
export function fillSolidZones(zone: MockZone, hex: string): void {
  const hsl = rgbToHsl(hexToRgb(hex));
  for (let i = 0; i < ZONE_COUNT; i += 1) write(zone, i, hsl);
}

/** Fills the grid with a left-to-right gradient: column 0 is `from`, column 27 is `to`. */
export function fillGradientZones(zone: MockZone, from: string, to: string): void {
  for (let x = 0; x < ZONE_COLUMNS; x += 1) {
    const hsl = rgbToHsl(hexToRgb(lerpColor(from, to, x / (ZONE_COLUMNS - 1))));
    for (let y = 0; y < ZONE_ROWS; y += 1) write(zone, y * ZONE_COLUMNS + x, hsl);
  }
}

/**
 * Downsamples RGBA pixels (`width`×`height`, row-major) to the 28×20 grid: each cell takes the
 * average RGB of the pixels it covers (alpha ignored), at least one pixel per cell.
 */
export function sampleZones(
  zone: MockZone,
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): void {
  if (width <= 0 || height <= 0) return;
  for (let cy = 0; cy < ZONE_ROWS; cy += 1) {
    const y0 = Math.min(height - 1, Math.floor((cy * height) / ZONE_ROWS));
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * height) / ZONE_ROWS));
    for (let cx = 0; cx < ZONE_COLUMNS; cx += 1) {
      const x0 = Math.min(width - 1, Math.floor((cx * width) / ZONE_COLUMNS));
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * width) / ZONE_COLUMNS));
      const sum: Rgb = { r: 0, g: 0, b: 0 };
      let count = 0;
      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const offset = (y * width + x) * 4;
          sum.r += pixels[offset]!;
          sum.g += pixels[offset + 1]!;
          sum.b += pixels[offset + 2]!;
          count += 1;
        }
      }
      write(
        zone,
        cy * ZONE_COLUMNS + cx,
        rgbToHsl({ r: sum.r / count, g: sum.g / count, b: sum.b / count }),
      );
    }
  }
}
```

`packages/srgb-effect-kit/src/devtools/meters.ts`:
```ts
import { rgbToHsl } from '../runtime/color';
import type { AreaMeter, LinearMeter, MeterDef, Range } from '../shared';

/** Meters whose value the devtools can compute from captured pixels. */
export type HslMeter = LinearMeter | AreaMeter;

export const isHslMeter = (meter: MeterDef): meter is HslMeter =>
  meter.type === 'linear' || meter.type === 'area';

/** A meter's region in normalized 0–1 screen coordinates. `height` is 0 for linear meters. */
export interface MeterRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A region in whole pixels, inside the frame. */
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Relative tolerance when matching a screen to a resolution's `aspect`; marketing ratios are rounded. */
const ASPECT_TOLERANCE = 0.03;

const parsePair = (value: string, separator: string): [number, number] => {
  const [a = '0', b = '0'] = value.split(separator);
  return [Number(a), Number(b)];
};

/**
 * The meter's region for a `screenWidth`×`screenHeight` screen: the first resolution whose `size`
 * matches exactly, else the first whose `aspect` matches within 3% (so 3440×1440 counts as 21:9), merged over the meter's own
 * region; the meter's region when none matches.
 */
export function resolveMeterRegion(
  meter: MeterDef,
  screenWidth: number,
  screenHeight: number,
): MeterRegion {
  const base: MeterRegion = {
    x: meter.x,
    y: meter.y,
    width: meter.width,
    height: meter.type === 'linear' ? 0 : meter.height,
  };
  const resolutions = meter.resolutions ?? [];
  const ratio = screenWidth / screenHeight;
  const match =
    resolutions.find((r) => {
      if (r.size === undefined) return false;
      const [w, h] = parsePair(r.size, 'x');
      return w === screenWidth && h === screenHeight;
    }) ??
    resolutions.find((r) => {
      if (r.aspect === undefined) return false;
      const [w, h] = parsePair(r.aspect, ':');
      return Math.abs(ratio - w / h) <= (w / h) * ASPECT_TOLERANCE;
    });
  if (!match) return base;
  return {
    x: match.x ?? base.x,
    y: match.y ?? base.y,
    width: match.width ?? base.width,
    height: meter.type === 'linear' ? 0 : (match.height ?? base.height),
  };
}

/**
 * Converts a normalized region to pixels in a `width`×`height` frame. Linear meters are one row
 * high; every rect is at least 1×1 and clipped to the frame.
 */
export function toPixelRect(
  region: MeterRegion,
  linear: boolean,
  width: number,
  height: number,
): PixelRect {
  const x = Math.min(width - 1, Math.max(0, Math.floor(region.x * width)));
  const y = Math.min(height - 1, Math.max(0, Math.floor(region.y * height)));
  const w = Math.max(1, Math.round(region.width * width));
  const h = linear ? 1 : Math.max(1, Math.round(region.height * height));
  return { x, y, width: Math.min(w, width - x), height: Math.min(h, height - y) };
}

const within = (value: number, [min, max]: Range) => value >= min && value <= max;

/**
 * Fraction (0–1) of the pixels in `rect` whose HSL falls inside the meter's `h`, `s` and `l`
 * ranges (inclusive). `hdr` ranges are not simulated.
 */
export function evaluateHslMeter(
  meter: HslMeter,
  pixels: ArrayLike<number>,
  width: number,
  rect: PixelRect,
): number {
  let matches = 0;
  const total = rect.width * rect.height;
  if (total <= 0) return 0;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      const offset = (y * width + x) * 4;
      const { h, s, l } = rgbToHsl({
        r: pixels[offset]!,
        g: pixels[offset + 1]!,
        b: pixels[offset + 2]!,
      });
      if (within(h, meter.h) && within(s, meter.s) && within(l, meter.l)) matches += 1;
    }
  }
  return matches / total;
}

/**
 * Restricts a manual value to what the meter type can report: 0–1 for `linear` and `area`,
 * -1, 0 or 1 for `ocr_textmatch`, an integer ≥ -1 for `ocr_numeric`. NaN becomes the type's
 * "nothing found" value (0, 0 and -1); infinite `ocr_numeric` values become -1 too.
 */
export function clampMeterValue(meter: MeterDef, value: number): number {
  switch (meter.type) {
    case 'linear':
    case 'area':
      return Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));
    case 'ocr_textmatch':
      return Number.isNaN(value) ? 0 : Math.min(1, Math.max(-1, Math.round(value)));
    case 'ocr_numeric':
      return Number.isFinite(value) ? Math.max(-1, Math.round(value)) : -1;
  }
}
```

- [ ] **Step 3: Run the tests and checks**

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools && pnpm --filter srgb-effect-kit typecheck && pnpm lint && pnpm format`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/srgb-effect-kit/src/devtools
git commit -m "feat(devtools): add audio, screen-zone and meter simulation math" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 5: Renderer/FPS simulation and console counter, applied before effect code

**Files:**
- Create: `packages/srgb-effect-kit/src/devtools/renderer.ts`, `packages/srgb-effect-kit/src/devtools/consoleCounter.ts`
- Modify: `packages/srgb-effect-kit/src/devtools/{context,index,index.test}.ts`
- Test: `packages/srgb-effect-kit/src/devtools/renderer.test.ts`, `packages/srgb-effect-kit/src/devtools/consoleCounter.test.ts`

**Interfaces:**
- Consumes:
  - From Task 1: `FrameScheduler`, `DevtoolsWindow`, `DevtoolsStorage`, `startDevtools`.
  - From the runtime: `Renderer`, `detectRenderer`.
- Produces:
  - **`renderer.ts`:**
    - `FPS_MIN = 20`, `FPS_MAX = 60`
    - `SIMULATED_USER_AGENTS: Record<'ultralight' | 'qtwebengine', string>`
    - `interface RendererSettings { renderer: Renderer; fps: number }`
    - `DEFAULT_RENDERER_SETTINGS`
    - `clampFps(fps)`, `isRendererSettings(value)`
    - `overrideUserAgent(navigator, userAgent)`
    - `createRafThrottle(native, getFps): FrameScheduler`
    - `interface RendererController { settings; setRenderer(r); setFps(fps); subscribe }`
    - `installRendererSimulation(win, storage, native, reload?)`
  - **`consoleCounter.ts`:**
    - `COUNTED_METHODS = ['log', 'info', 'warn', 'error', 'debug']`
    - `type CountedMethod`
    - `type ConsoleCounts = Record<CountedMethod | 'uncaught', number>`
    - `interface ConsoleCounter { counts; total; reset(); subscribe; restore() }`
    - `installConsoleCounter(win)`
  - **`DevtoolsContext`** gains `renderer` and `consoleCounter`.

Behaviour:
- **Browser** (the default): no simulation.
- **UltraLight:** overrides the user agent and replaces `window.requestAnimationFrame`/`cancelAnimationFrame` with a throttle at the FPS setting.
- **QtWebEngine:** overrides the user agent and keeps the native rAF.
- **Changing the renderer** persists it, then reloads the page, so effect code starts under it. **Changing the FPS** applies live.
- **The console counter** counts the calls of the 5 methods, plus `error` and `unhandledrejection` events. It skips messages that start with `[vite]`.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/devtools/renderer.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDevtoolsWindow } from '../../test/helpers/devtools';
import { detectRenderer } from '../runtime/renderer';
import type { FrameScheduler } from './context';
import {
  clampFps,
  createRafThrottle,
  installRendererSimulation,
  overrideUserAgent,
  SIMULATED_USER_AGENTS,
} from './renderer';
import { createStorage } from './storage';

/** A native rAF driven by `tick(timestamp)`, one call per display refresh. */
const fakeNative = () => {
  let queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const native: FrameScheduler = {
    request: (callback) => {
      queue.set(nextId, callback);
      return nextId++;
    },
    cancel: (id) => void queue.delete(id),
  };
  const tick = (timestamp: number) => {
    const callbacks = queue;
    queue = new Map();
    for (const callback of callbacks.values()) callback(timestamp);
  };
  return { native, tick, pending: () => queue.size };
};

/** Runs `refreshes` 60 Hz refreshes starting at t=1000 and keeps `request` looping like a render loop. */
const runLoop = (scheduler: FrameScheduler, tick: (t: number) => void, refreshes: number) => {
  const frames: number[] = [];
  const frame = (timestamp: number) => {
    frames.push(timestamp);
    scheduler.request(frame);
  };
  scheduler.request(frame);
  for (let i = 0; i < refreshes; i += 1) tick(1000 + i * (1000 / 60));
  return frames;
};

const userAgent = navigator.userAgent;
const nativeRaf = window.requestAnimationFrame;
const nativeCaf = window.cancelAnimationFrame;
const storage = () => createStorage('Renderer Test', () => localStorage);

beforeEach(() => resetDevtoolsWindow());
afterEach(() => {
  overrideUserAgent(navigator, userAgent);
  window.requestAnimationFrame = nativeRaf;
  window.cancelAnimationFrame = nativeCaf;
});

describe('simulated user agents', () => {
  it('match the runtime renderer signatures', () => {
    expect(detectRenderer(SIMULATED_USER_AGENTS.ultralight)).toBe('ultralight');
    expect(detectRenderer(SIMULATED_USER_AGENTS.qtwebengine)).toBe('qtwebengine');
  });

  it('override navigator.userAgent', () => {
    overrideUserAgent(navigator, SIMULATED_USER_AGENTS.qtwebengine);
    expect(navigator.userAgent).toBe(SIMULATED_USER_AGENTS.qtwebengine);
    expect(detectRenderer()).toBe('qtwebengine');
  });
});

describe('createRafThrottle', () => {
  it('runs a 60 Hz loop at the FPS setting', () => {
    const { native, tick } = fakeNative();
    // 61 refreshes span one second; both ends render, as with createLoop's cap.
    expect(
      runLoop(
        createRafThrottle(native, () => 30),
        tick,
        61,
      ),
    ).toHaveLength(31);
    const fresh = fakeNative();
    expect(
      runLoop(
        createRafThrottle(fresh.native, () => 20),
        fresh.tick,
        61,
      ),
    ).toHaveLength(21);
    const full = fakeNative();
    expect(
      runLoop(
        createRafThrottle(full.native, () => 60),
        full.tick,
        61,
      ),
    ).toHaveLength(61);
  });

  it('follows FPS changes immediately', () => {
    const { native, tick } = fakeNative();
    let fps = 60;
    const throttle = createRafThrottle(native, () => fps);
    const frames: number[] = [];
    const frame = (t: number) => {
      frames.push(t);
      throttle.request(frame);
    };
    throttle.request(frame);
    for (let i = 0; i < 30; i += 1) tick(1000 + i * (1000 / 60));
    fps = 20;
    for (let i = 30; i < 90; i += 1) tick(1000 + i * (1000 / 60));
    expect(frames.length).toBe(30 + 20);
  });

  it('passes the refresh timestamp, supports cancel and stops requesting when idle', () => {
    const { native, tick, pending } = fakeNative();
    const throttle = createRafThrottle(native, () => 30);
    const kept = vi.fn();
    const cancelled = vi.fn();
    throttle.request(kept);
    throttle.cancel(throttle.request(cancelled));
    tick(1000);
    expect(kept).toHaveBeenCalledWith(1000);
    expect(cancelled).not.toHaveBeenCalled();
    expect(pending()).toBe(0);
  });
});

describe('installRendererSimulation', () => {
  it('leaves the browser untouched by default', () => {
    const { native } = fakeNative();
    const controller = installRendererSimulation(window, storage(), native, vi.fn());
    expect(controller.settings).toEqual({ renderer: 'browser', fps: 60 });
    expect(navigator.userAgent).toBe(userAgent);
    expect(window.requestAnimationFrame).toBe(nativeRaf);
  });

  it('simulates UltraLight: user agent and throttled rAF', () => {
    localStorage.setItem(
      'srgb-effect-kit:Renderer Test:renderer',
      JSON.stringify({ renderer: 'ultralight', fps: 30 }),
    );
    const { native, tick } = fakeNative();
    installRendererSimulation(window, storage(), native, vi.fn());
    expect(detectRenderer()).toBe('ultralight');
    const frames = runLoop(
      {
        request: (cb) => window.requestAnimationFrame(cb),
        cancel: (id) => window.cancelAnimationFrame(id),
      },
      tick,
      61,
    );
    expect(frames).toHaveLength(31);
  });

  it('simulates QtWebEngine with the native rAF rate', () => {
    localStorage.setItem(
      'srgb-effect-kit:Renderer Test:renderer',
      JSON.stringify({ renderer: 'qtwebengine', fps: 20 }),
    );
    installRendererSimulation(window, storage(), fakeNative().native, vi.fn());
    expect(detectRenderer()).toBe('qtwebengine');
    expect(window.requestAnimationFrame).toBe(nativeRaf);
  });

  it('persists FPS changes live and reloads on renderer changes', () => {
    const reload = vi.fn();
    const controller = installRendererSimulation(window, storage(), fakeNative().native, reload);
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setFps(45.4);
    expect(controller.settings.fps).toBe(45);
    expect(listener).toHaveBeenCalledWith({ renderer: 'browser', fps: 45 });
    expect(reload).not.toHaveBeenCalled();
    controller.setRenderer('browser');
    expect(reload).not.toHaveBeenCalled();
    controller.setRenderer('ultralight');
    expect(reload).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem('srgb-effect-kit:Renderer Test:renderer')!)).toEqual({
      renderer: 'ultralight',
      fps: 45,
    });
  });

  it('ignores invalid stored settings and clamps the FPS', () => {
    localStorage.setItem('srgb-effect-kit:Renderer Test:renderer', '{"renderer":"netscape"}');
    expect(installRendererSimulation(window, storage(), fakeNative().native).settings).toEqual({
      renderer: 'browser',
      fps: 60,
    });
    expect([clampFps(5), clampFps(144), clampFps(Number.NaN), clampFps(29.6)]).toEqual([
      20, 60, 60, 30,
    ]);
  });
});
```

`packages/srgb-effect-kit/src/devtools/consoleCounter.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installConsoleCounter, type ConsoleCounter } from './consoleCounter';

let counter: ConsoleCounter;
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  for (const method of ['log', 'info', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation(() => {});
  }
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  counter = installConsoleCounter(window);
});
afterEach(() => {
  counter.restore();
  vi.restoreAllMocks();
});

describe('installConsoleCounter', () => {
  it('counts each method and still forwards the call', () => {
    console.log('a');
    console.log('b');
    console.warn('c');
    console.error('d');
    console.info('e');
    console.debug('f');
    expect(counter.counts).toMatchObject({ log: 2, warn: 1, error: 1, info: 1, debug: 1 });
    expect(counter.total).toBe(6);
    expect(warn).toHaveBeenCalledWith('c');
  });

  it("ignores Vite's own messages", () => {
    console.debug('[vite] connecting...');
    console.error('[vite] server connection lost');
    expect(counter.total).toBe(0);
  });

  it('counts uncaught errors and unhandled rejections', () => {
    window.dispatchEvent(new Event('error'));
    window.dispatchEvent(new Event('unhandledrejection'));
    expect(counter.counts.uncaught).toBe(2);
  });

  it('notifies subscribers, resets and restores', () => {
    const listener = vi.fn();
    counter.subscribe(listener);
    console.log('x');
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ log: 1 }));
    counter.reset();
    expect(counter.total).toBe(0);
    counter.restore();
    console.log('y');
    window.dispatchEvent(new Event('error'));
    expect(counter.total).toBe(0);
  });
});
```

In `packages/srgb-effect-kit/src/devtools/index.test.ts`, make these replacements:

1. Replace:

```ts
import { startDevtools, type DevtoolsContext, type StartOptions } from './index';
```

with:

```ts
import { startDevtools, type DevtoolsContext, type StartOptions } from './index';
import { overrideUserAgent } from './renderer';
```

2. Replace:

```ts
const globals = window as unknown as Record<string, unknown>;
```

with:

```ts
const globals = window as unknown as Record<string, unknown>;
const userAgent = navigator.userAgent;
```

3. Replace:

```ts
afterEach(() => {
  started.length = 0;
  restoreReadyState();
```

with:

```ts
afterEach(() => {
  // Unwrap the console before restoring spies, so the spies' originals come back last.
  for (const context of started.splice(0)) context.consoleCounter.restore();
  vi.restoreAllMocks();
  overrideUserAgent(navigator, userAgent);
  restoreReadyState();
```

4. Replace:

```ts
  it('returns the existing context when started twice', () => {
```

with:

```ts
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

  it('returns the existing context when started twice', () => {
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools`
Expected: FAIL. `./renderer` and `./consoleCounter` cannot be resolved.

- [ ] **Step 2: Implement**

`packages/srgb-effect-kit/src/devtools/renderer.ts`:
```ts
import type { Renderer } from '../runtime/renderer';
import type { DevtoolsWindow, FrameScheduler } from './context';
import type { DevtoolsStorage } from './storage';

/** SignalRGB's FPS setting range. */
export const FPS_MIN = 20;
export const FPS_MAX = 60;

/**
 * User agents the simulation reports. Placeholders until the probe records the real strings; each
 * must match its renderer in `RENDERER_SIGNATURES`, so `detectRenderer()` needs no dev hook.
 */
export const SIMULATED_USER_AGENTS: Readonly<Record<Exclude<Renderer, 'browser'>, string>> = {
  ultralight:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/615.1.18.100.1 (KHTML, like Gecko) Ultralight/1.4.0 Version/16.4.1 Safari/615.1.18.100.1',
  qtwebengine:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/6.8.2 Chrome/122.0.6261.171 Safari/537.36',
};

/** Persisted Renderer tab state. */
export interface RendererSettings {
  renderer: Renderer;
  /** SignalRGB's FPS setting, 20–60. */
  fps: number;
}

export const DEFAULT_RENDERER_SETTINGS: RendererSettings = { renderer: 'browser', fps: 60 };

const RENDERERS: readonly Renderer[] = ['browser', 'ultralight', 'qtwebengine'];
const STORAGE_KEY = 'renderer';

export const clampFps = (fps: number): number =>
  Number.isFinite(fps) ? Math.min(FPS_MAX, Math.max(FPS_MIN, Math.round(fps))) : FPS_MAX;

export const isRendererSettings = (value: unknown): value is RendererSettings => {
  if (typeof value !== 'object' || value === null) return false;
  const { renderer, fps } = value as Record<string, unknown>;
  return RENDERERS.includes(renderer as Renderer) && typeof fps === 'number';
};

/** Makes `navigator.userAgent` report `userAgent` for the rest of the page's life. */
export function overrideUserAgent(navigator: Navigator, userAgent: string): void {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, get: () => userAgent });
}

/** rAF timestamps may arrive this many ms early and still count, to absorb jitter. */
const JITTER_TOLERANCE_MS = 1;

/**
 * A `requestAnimationFrame` that runs callbacks at most `getFps()` times per second, like
 * UltraLight does at SignalRGB's FPS setting. Callbacks requested during a flush run in a later
 * one. Built on `native`, which must be the unpatched rAF.
 */
export function createRafThrottle(native: FrameScheduler, getFps: () => number): FrameScheduler {
  let nextId = 1;
  let pending = new Map<number, FrameRequestCallback>();
  let scheduled = false;
  let anchor: number | undefined;

  const pump = (timestamp: number) => {
    scheduled = false;
    if (pending.size === 0) return;
    const interval = 1000 / getFps();
    if (anchor !== undefined) {
      const elapsed = timestamp - anchor;
      if (elapsed < interval - JITTER_TOLERANCE_MS) {
        schedule();
        return;
      }
      // Advance by whole intervals so the cadence doesn't drift.
      const remainder = elapsed % interval;
      anchor = remainder > interval - JITTER_TOLERANCE_MS ? timestamp : timestamp - remainder;
    } else {
      anchor = timestamp;
    }
    const callbacks = pending;
    pending = new Map();
    for (const callback of callbacks.values()) callback(timestamp);
  };
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    native.request(pump);
  };

  return {
    request(callback) {
      const id = nextId;
      nextId += 1;
      pending.set(id, callback);
      schedule();
      return id;
    },
    cancel(id) {
      pending.delete(id);
    },
  };
}

/** The Renderer tab's state and actions. */
export interface RendererController {
  readonly settings: Readonly<RendererSettings>;
  /** Persists the renderer, then reloads the page so effect code starts under it. */
  setRenderer(renderer: Renderer): void;
  /** Persists and applies the FPS setting immediately. */
  setFps(fps: number): void;
  subscribe(listener: (settings: Readonly<RendererSettings>) => void): () => void;
}

/**
 * Applies the persisted simulation before effect code runs: the renderer's user agent and, for
 * UltraLight, a rAF throttled to the FPS setting. QtWebEngine keeps the native rAF rate.
 */
export function installRendererSimulation(
  win: DevtoolsWindow,
  storage: DevtoolsStorage,
  native: FrameScheduler,
  reload: () => void = () => win.location.reload(),
): RendererController {
  const stored = storage.read(STORAGE_KEY, isRendererSettings);
  let settings: RendererSettings = stored
    ? { renderer: stored.renderer, fps: clampFps(stored.fps) }
    : { ...DEFAULT_RENDERER_SETTINGS };
  const listeners = new Set<(settings: Readonly<RendererSettings>) => void>();

  if (settings.renderer !== 'browser') {
    overrideUserAgent(win.navigator, SIMULATED_USER_AGENTS[settings.renderer]);
  }
  if (settings.renderer === 'ultralight') {
    const throttle = createRafThrottle(native, () => settings.fps);
    win.requestAnimationFrame = (callback) => throttle.request(callback);
    win.cancelAnimationFrame = (id) => throttle.cancel(id);
  }

  const update = (next: RendererSettings) => {
    settings = next;
    storage.write(STORAGE_KEY, settings);
    for (const listener of listeners) listener(settings);
  };

  return {
    get settings() {
      return settings;
    },
    setRenderer(renderer) {
      if (renderer === settings.renderer) return;
      update({ ...settings, renderer });
      reload();
    },
    setFps(fps) {
      update({ ...settings, fps: clampFps(fps) });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
```

`packages/srgb-effect-kit/src/devtools/consoleCounter.ts`:
```ts
import type { DevtoolsWindow } from './context';

/** Console methods whose calls are counted. */
export const COUNTED_METHODS = ['log', 'info', 'warn', 'error', 'debug'] as const;
export type CountedMethod = (typeof COUNTED_METHODS)[number];

/** Calls per console method, plus uncaught errors and unhandled rejections. */
export type ConsoleCounts = Record<CountedMethod | 'uncaught', number>;

/** Counts console output, since SignalRGB requires a clean console. */
export interface ConsoleCounter {
  readonly counts: Readonly<ConsoleCounts>;
  readonly total: number;
  reset(): void;
  subscribe(listener: (counts: Readonly<ConsoleCounts>) => void): () => void;
  /** Puts the original console methods back and stops listening for errors. */
  restore(): void;
}

const zero = (): ConsoleCounts => ({ log: 0, info: 0, warn: 0, error: 0, debug: 0, uncaught: 0 });

/** Vite's client logs through the console too; those messages start with `[vite]`. */
const isViteMessage = (args: unknown[]) =>
  typeof args[0] === 'string' && args[0].startsWith('[vite]');

/**
 * Wraps the page's console methods to count calls (still forwarding them) and listens for uncaught
 * errors and unhandled rejections. Messages from Vite's client are not counted.
 */
export function installConsoleCounter(win: DevtoolsWindow): ConsoleCounter {
  const counts = zero();
  const listeners = new Set<(counts: Readonly<ConsoleCounts>) => void>();
  const notify = () => {
    for (const listener of listeners) listener(counts);
  };
  const count = (key: keyof ConsoleCounts) => {
    counts[key] += 1;
    notify();
  };

  const console = win.console;
  const originals = new Map<CountedMethod, (...args: unknown[]) => void>();
  for (const method of COUNTED_METHODS) {
    const original = console[method] as (...args: unknown[]) => void;
    originals.set(method, original);
    console[method] = (...args: unknown[]) => {
      if (!isViteMessage(args)) count(method);
      original.apply(console, args);
    };
  }
  const onError = () => count('uncaught');
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onError);

  return {
    counts,
    get total() {
      return Object.values(counts).reduce((sum, value) => sum + value, 0);
    },
    reset() {
      Object.assign(counts, zero());
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    restore() {
      for (const [method, original] of originals) console[method] = original;
      win.removeEventListener('error', onError);
      win.removeEventListener('unhandledrejection', onError);
    },
  };
}
```

In `packages/srgb-effect-kit/src/devtools/context.ts`, make these replacements:

1. Replace:

```ts
import type { CanvasApiController } from './canvasApi';
```

with:

```ts
import type { CanvasApiController } from './canvasApi';
import type { ConsoleCounter } from './consoleCounter';
```

2. Replace:

```ts
import type { PropertyController } from './properties';
```

with:

```ts
import type { PropertyController } from './properties';
import type { RendererController } from './renderer';
```

3. Replace:

```ts
  readonly raf: FrameScheduler;
}
```

with:

```ts
  readonly raf: FrameScheduler;
  readonly renderer: RendererController;
  readonly consoleCounter: ConsoleCounter;
}
```

In `packages/srgb-effect-kit/src/devtools/index.ts`, make these replacements:

1. Replace:

```ts
import type { DevtoolsContext, FrameScheduler, StartOptions } from './context';
```

with:

```ts
import type { DevtoolsContext, FrameScheduler, StartOptions } from './context';
import { installConsoleCounter } from './consoleCounter';
import { installRendererSimulation } from './renderer';
```

2. Replace:

```ts
  const simulation = startSimulation(config, win, storage, hot);
```

with:

```ts
  // Before effect code runs: it may read the user agent or start its loop at the top level.
  const renderer = installRendererSimulation(win, storage, raf);
  const consoleCounter = installConsoleCounter(win);
  const simulation = startSimulation(config, win, storage, hot);
```

3. Replace:

```ts
  const context: DevtoolsContext = { ...simulation, storage, raf };
```

with:

```ts
  const context: DevtoolsContext = {
    ...simulation,
    storage,
    raf,
    renderer,
    consoleCounter,
  };
```

- [ ] **Step 3: Run the tests and checks**

Run: `pnpm --filter srgb-effect-kit test && pnpm --filter srgb-effect-kit typecheck && pnpm lint && pnpm format`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/srgb-effect-kit/src/devtools
git commit -m "feat(devtools): simulate renderers and count console output" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 6: Drawer shell, visible-area marker and mounting

**Files:**
- Create: `packages/srgb-effect-kit/src/devtools/ui/{dom,styles,overlay,drawer,index}.ts`, `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts`
- Modify: `packages/srgb-effect-kit/src/devtools/index.ts`, `packages/srgb-effect-kit/src/devtools/index.test.ts`, `e2e/devtools.spec.ts`
- Test: `packages/srgb-effect-kit/src/devtools/ui/{dom,overlay,drawer}.test.ts`

**Interfaces:**
- Consumes: `DevtoolsContext` (`win`, `storage`) from Tasks 1–5.
- Produces:
  - **`ui/dom.ts`:**
    - `type AttrValue`, `type Child`
    - `h(tag, attrs?, ...children)`. Strings are always appended as text nodes.
    - `rafBatch(request, update): () => void`. It coalesces updates to one per frame, using the native rAF.
  - **`ui/styles.ts`:** `DEVTOOLS_CSS`. This is the full stylesheet, including the classes later tabs use: `rows`, `row`, `value`, `actions`, `note`, `error`, `segmented`, `button`, `bar`, `preview`, `log`, `hue`.
  - **`ui/overlay.ts`:**
    - `VISIBLE_WIDTH = 320`, `VISIBLE_HEIGHT = 200`
    - `interface OverlayState { marker; dim }`
    - `createAreaOverlay(): { element; update(state) }`
  - **`ui/drawer.ts`:**
    - `HOST_TAG = 'srgb-effect-devtools'`, `MIN_DRAWER_SIZE = 160`
    - `type Dock = 'bottom' | 'right'`
    - `interface DrawerState { open; dock; size; tab; marker; dim }`
    - `DEFAULT_DRAWER_STATE`
    - `interface TabInstance { element; show?(); hide?() }`
    - `interface TabDefinition { id; label; create(context): TabInstance }`
    - `interface DrawerHandle { host; root; state; open; close; toggle; setDock; setSize; select; setOverlay; setBadge }`
    - `isDrawerState(value)`, `clampDrawerSize(size, dock, viewport)`
    - `mountDrawer(context, tabs)`
  - **`ui/index.ts`:** `mountUi(context): DrawerHandle`.
  - **`ui/tabs/index.ts`:** `TABS: readonly TabDefinition[]`, empty for now. Tasks 7–11 fill it.
  - The bootstrap calls `mountUi(context)` on DOM ready, right after the load-time handler calls.

DOM contract, inside the open shadow root of `<srgb-effect-devtools>`:
- **Host:** appended to `<html>`, not `<body>`. It has the inline style `position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block`.
- **Toggle:** `[data-srgb-devtools=toggle]` (bottom-right, shows "SRGB", hidden while open) contains `[data-srgb-devtools=badge]`.
- **Panel:** `[data-srgb-devtools=panel]` carries `data-dock` and the CSS variable `--size`, and is hidden while closed. Inside it:
  - `[data-srgb-devtools=resize]`, which drags the top edge (bottom dock) or the left edge (right dock);
  - a `role=tablist` with one `[data-srgb-devtools-tab=<id>]` button per tab, carrying `aria-selected`;
  - the tool buttons `[data-srgb-devtools=marker]` and `[data-srgb-devtools=dim]` (both with `aria-pressed`), `[data-srgb-devtools=dock]` and `[data-srgb-devtools=close]`;
  - `[data-srgb-devtools=content]`.
- **Tabs:** a tab is created on its first selection while open. Only the selected tab is visible. `hide()` runs on the outgoing tab and `show()` on the incoming one.
- **Overlay:** `[data-srgb-devtools=area]` holds two red lines, `area-right` (x = 320, 201 px high) and `area-bottom` (y = 200, 321 px wide), plus the dims `dim-right` and `dim-bottom`. None of it takes pointer events.
- **State:** persisted under the `drawer` key, and validated on read; an unknown tab falls back to the first tab. The size is clamped to 160 px..90% of the viewport along the dock axis, also on window resize.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/devtools/ui/dom.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { h, rafBatch } from './dom';

describe('h', () => {
  it('sets attributes and appends children as text, never HTML', () => {
    const element = h(
      'button',
      { type: 'button', disabled: true, hidden: false, title: undefined, 'data-n': 3 },
      '<b>label</b>',
      4,
      null,
      h('span'),
    );
    expect(element.outerHTML).toBe(
      '<button type="button" disabled="" data-n="3">&lt;b&gt;label&lt;/b&gt;4<span></span></button>',
    );
  });
});

describe('rafBatch', () => {
  it('runs the update once per frame however often it is scheduled', () => {
    const frames: FrameRequestCallback[] = [];
    const update = vi.fn();
    const schedule = rafBatch((callback) => frames.push(callback), update);
    schedule();
    schedule();
    expect(frames).toHaveLength(1);
    frames[0]!(0);
    expect(update).toHaveBeenCalledOnce();
    schedule();
    expect(frames).toHaveLength(2);
  });
});
```

`packages/srgb-effect-kit/src/devtools/ui/overlay.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createAreaOverlay, VISIBLE_HEIGHT, VISIBLE_WIDTH } from './overlay';

const part = (element: HTMLElement, name: string) =>
  element.querySelector<HTMLElement>(`[data-srgb-devtools="${name}"]`)!;

describe('createAreaOverlay', () => {
  it('draws the marker lines just outside the visible 320×200 area', () => {
    const { element } = createAreaOverlay();
    expect([VISIBLE_WIDTH, VISIBLE_HEIGHT]).toEqual([320, 200]);
    expect(part(element, 'area-right').style.left).toBe('320px');
    expect(part(element, 'area-right').style.height).toBe('201px');
    expect(part(element, 'area-bottom').style.top).toBe('200px');
    expect(part(element, 'area-bottom').style.width).toBe('321px');
    expect(part(element, 'dim-right').style.left).toBe('321px');
    expect(part(element, 'dim-bottom').style.top).toBe('201px');
    expect(element.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the marker and the dimming independently', () => {
    const overlay = createAreaOverlay();
    overlay.update({ marker: false, dim: true });
    expect(part(overlay.element, 'area-right').hidden).toBe(true);
    expect(part(overlay.element, 'area-bottom').hidden).toBe(true);
    expect(part(overlay.element, 'dim-right').hidden).toBe(false);
    expect(part(overlay.element, 'dim-bottom').hidden).toBe(false);
  });
});
```

`packages/srgb-effect-kit/src/devtools/ui/drawer.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../../test/helpers/devtools';
import type { DevtoolsContext } from '../context';
import { createStorage } from '../storage';
import { h } from './dom';
import {
  clampDrawerSize,
  DEFAULT_DRAWER_STATE,
  isDrawerState,
  mountDrawer,
  type TabDefinition,
} from './drawer';

const STORAGE_KEY = 'srgb-effect-kit:Devtools Test:drawer';

const context = () =>
  ({
    win: window,
    storage: createStorage(MANIFEST.title, () => localStorage),
  }) as unknown as DevtoolsContext;

const tab = (id: string, hooks: Partial<Record<'show' | 'hide', () => void>> = {}) => {
  const create = vi.fn(() => ({ element: h('div', { 'data-tab-body': id }, id), ...hooks }));
  return { id, label: id.toUpperCase(), create } satisfies TabDefinition;
};

const find = (root: ShadowRoot, name: string) =>
  root.querySelector<HTMLElement>(`[data-srgb-devtools="${name}"]`)!;

beforeEach(() => resetDevtoolsWindow());

describe('mountDrawer', () => {
  it('mounts a closed drawer in an open shadow root on <html>', () => {
    const drawer = mountDrawer(context(), [tab('properties')]);
    expect(drawer.host.tagName).toBe('SRGB-EFFECT-DEVTOOLS');
    expect(drawer.host.parentElement).toBe(document.documentElement);
    expect(drawer.host.style.pointerEvents).toBe('none');
    expect(drawer.root.mode).toBe('open');
    expect(drawer.root.querySelector('style')?.textContent).toContain(':host');
    expect(find(drawer.root, 'panel').hidden).toBe(true);
    expect(find(drawer.root, 'toggle').hidden).toBe(false);
  });

  it('survives effect code that clears the body', () => {
    const drawer = mountDrawer(context(), []);
    document.body.innerHTML = '<canvas></canvas>';
    expect(drawer.host.isConnected).toBe(true);
  });

  it('toggles open and closed, persisting the state', () => {
    const drawer = mountDrawer(context(), [tab('properties')]);
    find(drawer.root, 'toggle').click();
    expect(find(drawer.root, 'panel').hidden).toBe(false);
    expect(find(drawer.root, 'toggle').hidden).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ open: true });
    find(drawer.root, 'close').click();
    expect(find(drawer.root, 'panel').hidden).toBe(true);
    expect(drawer.state.open).toBe(false);
  });

  it('creates tabs lazily and shows one at a time', () => {
    const hide = vi.fn();
    const show = vi.fn();
    const first = tab('properties', { hide });
    const second = tab('audio', { show });
    const drawer = mountDrawer(context(), [first, second]);
    expect(first.create).not.toHaveBeenCalled();
    drawer.open();
    expect(first.create).toHaveBeenCalledOnce();
    expect(second.create).not.toHaveBeenCalled();

    drawer.root.querySelector<HTMLElement>('[data-srgb-devtools-tab="audio"]')!.click();
    expect(drawer.state.tab).toBe('audio');
    expect(hide).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledOnce();
    const bodies = drawer.root.querySelectorAll<HTMLElement>('[data-tab-body]');
    expect([...bodies].map((body) => body.hidden)).toEqual([true, false]);
    expect(
      drawer.root.querySelector('[data-srgb-devtools-tab="audio"]')!.getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('restores persisted state, falling back for unknown tabs and invalid data', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_DRAWER_STATE, open: true, dock: 'right', tab: 'gone' }),
    );
    const drawer = mountDrawer(context(), [tab('properties')]);
    expect(drawer.state).toMatchObject({ open: true, dock: 'right', tab: 'properties' });
    expect(find(drawer.root, 'panel').dataset.dock).toBe('right');

    resetDevtoolsWindow();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ open: 'yes' }));
    expect(mountDrawer(context(), []).state).toEqual(DEFAULT_DRAWER_STATE);
  });

  it('docks, resizes within limits and toggles the overlay', () => {
    const drawer = mountDrawer(context(), []);
    find(drawer.root, 'dock').click();
    expect(drawer.state.dock).toBe('right');
    drawer.setSize(10);
    expect(drawer.state.size).toBe(160);
    drawer.setSize(100_000);
    expect(drawer.state.size).toBe(Math.floor(window.innerWidth * 0.9));

    expect(find(drawer.root, 'area-right').hidden).toBe(false);
    expect(find(drawer.root, 'dim-right').hidden).toBe(true);
    find(drawer.root, 'marker').click();
    find(drawer.root, 'dim').click();
    expect(find(drawer.root, 'area-right').hidden).toBe(true);
    expect(find(drawer.root, 'dim-right').hidden).toBe(false);
  });

  it('shows a badge count only when positive', () => {
    const drawer = mountDrawer(context(), []);
    drawer.setBadge(3);
    expect(find(drawer.root, 'badge').hidden).toBe(false);
    expect(find(drawer.root, 'badge').textContent).toBe('3');
    drawer.setBadge(250);
    expect(find(drawer.root, 'badge').textContent).toBe('99+');
    drawer.setBadge(0);
    expect(find(drawer.root, 'badge').hidden).toBe(true);
  });
});

describe('drawer helpers', () => {
  it('validates persisted state', () => {
    expect(isDrawerState(DEFAULT_DRAWER_STATE)).toBe(true);
    expect(isDrawerState({ ...DEFAULT_DRAWER_STATE, dock: 'left' })).toBe(false);
    expect(isDrawerState({ ...DEFAULT_DRAWER_STATE, size: Number.NaN })).toBe(false);
    expect(isDrawerState(null)).toBe(false);
  });

  it('clamps the size to 160px..90% of the viewport', () => {
    const viewport = { width: 1000, height: 500 };
    expect(clampDrawerSize(50, 'bottom', viewport)).toBe(160);
    expect(clampDrawerSize(480, 'bottom', viewport)).toBe(450);
    expect(clampDrawerSize(480, 'right', viewport)).toBe(480);
    expect(clampDrawerSize(300, 'bottom', { width: 100, height: 100 })).toBe(160);
  });
});
```

In `packages/srgb-effect-kit/src/devtools/index.test.ts`, replace:

Replace:

```ts
  it('returns the existing context when started twice', () => {
```

with:

```ts
  it('mounts the drawer once the DOM is ready', () => {
    setReadyState('interactive');
    start();
    expect(document.querySelector('srgb-effect-devtools')).toBeNull();
    document.dispatchEvent(new Event('DOMContentLoaded'));
    expect(document.querySelector('srgb-effect-devtools')?.shadowRoot).not.toBeNull();
  });

  it('returns the existing context when started twice', () => {
```

Append to `e2e/devtools.spec.ts`:
```ts
test('opens and closes the drawer', async ({ page }) => {
  await openEffect(page);
  const panel = page.locator('[data-srgb-devtools="panel"]');
  await expect(panel).toBeHidden();
  await page.locator('[data-srgb-devtools="toggle"]').click();
  await expect(panel).toBeVisible();
  await page.locator('[data-srgb-devtools="close"]').click();
  await expect(panel).toBeHidden();
});
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools`
Expected: FAIL. The `./ui/*` modules cannot be resolved, and the bootstrap test finds no host.

- [ ] **Step 2: Implement the helpers, the styles and the overlay**

`packages/srgb-effect-kit/src/devtools/ui/dom.ts`:
```ts
/** Attribute values: `true` sets an empty attribute; `false`, `null` and `undefined` omit it. */
export type AttrValue = string | number | boolean | null | undefined;
/** Children: strings and numbers become text nodes (never parsed as HTML); falsy ones are skipped. */
export type Child = Node | string | number | null | undefined | false;

/** Creates an element with attributes and children. Manifest strings are always safe as children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === false || child === null || child === undefined) continue;
    element.append(typeof child === 'number' ? String(child) : child);
  }
  return element;
}

/**
 * Coalesces updates to one per animation frame, using the native rAF so the UltraLight simulation
 * doesn't slow the UI down.
 */
export function rafBatch(
  request: (callback: FrameRequestCallback) => number,
  update: () => void,
): () => void {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    request(() => {
      queued = false;
      update();
    });
  };
}
```

`packages/srgb-effect-kit/src/devtools/ui/styles.ts`. This is the complete stylesheet; later tabs only use its classes.
```ts
/** All devtools CSS. It lives in a string so it can be placed inside the shadow root. */
export const DEVTOOLS_CSS = `
:host {
  all: initial;
  color-scheme: dark;
  font: 12px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #e6e6e6;
}
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
button, input, select { font: inherit; color: inherit; }

.area { position: absolute; inset: 0; pointer-events: none; }
.area-line { position: absolute; background: #ff1744; }
.area-dim { position: absolute; background: rgb(0 0 0 / 0.6); }

.toggle {
  position: absolute; right: 12px; bottom: 12px; pointer-events: auto;
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;
  border: 1px solid #3a3f4b; border-radius: 999px; background: #16181d; cursor: pointer;
  font-weight: 600; box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
}
.badge {
  min-width: 18px; padding: 0 5px; border-radius: 9px; background: #f5a623; color: #16181d;
  font-size: 11px; text-align: center;
}

.panel {
  position: absolute; pointer-events: auto; display: flex; flex-direction: column;
  background: #16181d; box-shadow: 0 0 16px rgb(0 0 0 / 0.5);
}
.panel[data-dock='bottom'] { left: 0; right: 0; bottom: 0; height: var(--size); border-top: 1px solid #3a3f4b; }
.panel[data-dock='right'] { top: 0; right: 0; bottom: 0; width: var(--size); border-left: 1px solid #3a3f4b; }
.resize { position: absolute; z-index: 1; }
.panel[data-dock='bottom'] .resize { left: 0; right: 0; top: -3px; height: 6px; cursor: ns-resize; }
.panel[data-dock='right'] .resize { top: 0; bottom: 0; left: -3px; width: 6px; cursor: ew-resize; }
.header { display: flex; align-items: center; gap: 8px; padding: 0 8px; border-bottom: 1px solid #3a3f4b; }
.tabs { display: flex; flex: 1; overflow-x: auto; }
.panel[data-dock='right'] .header { flex-wrap: wrap; padding-top: 6px; }
.panel[data-dock='right'] .tools { margin-left: auto; }
.panel[data-dock='right'] .tabs { order: 1; flex-basis: 100%; }
.tab { padding: 8px 10px; border: 0; border-bottom: 2px solid transparent; background: none; cursor: pointer; white-space: nowrap; }
.tab[aria-selected='true'] { border-bottom-color: #4c8dff; color: #fff; }
.tools { display: flex; gap: 4px; }
.tool, .button {
  padding: 3px 8px; border: 1px solid #3a3f4b; border-radius: 4px; background: #20232a; cursor: pointer;
}
.tool[aria-pressed='true'], .segmented [aria-pressed='true'] { background: #4c8dff; border-color: #4c8dff; color: #fff; }
.button:disabled { opacity: 0.5; cursor: default; }
.content { flex: 1; overflow: auto; padding: 12px; }

.rows { display: grid; gap: 8px; }
.row { display: grid; grid-template-columns: minmax(110px, 30%) minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.row > label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row > input[type='checkbox'], .row > input[type='color'] { justify-self: start; }
.value { min-width: 5ch; text-align: right; font-variant-numeric: tabular-nums; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.note { margin: 8px 0 0; color: #9aa0a6; }
.error { color: #ff6b6b; }
.segmented { display: inline-flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.segmented button { padding: 3px 8px; border: 1px solid #3a3f4b; border-radius: 4px; background: #20232a; cursor: pointer; }
input[type='text'], input[type='number'], select {
  min-width: 0; padding: 3px 6px; border: 1px solid #3a3f4b; border-radius: 4px; background: #0f1115;
}
input[type='range'] { width: 100%; }
input[type='range'].hue {
  appearance: none; height: 8px; border-radius: 4px; background: var(--track);
}
input[type='range'].hue::-webkit-slider-thumb {
  appearance: none; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; background: transparent;
}
input[type='color'] { width: 48px; height: 24px; padding: 0; border: 1px solid #3a3f4b; background: none; }
.bar { height: 8px; border-radius: 4px; background: #20232a; overflow: hidden; }
.bar > span { display: block; height: 100%; background: #4c8dff; }
canvas.preview { display: block; max-width: 100%; border: 1px solid #3a3f4b; image-rendering: pixelated; }
.log { margin: 8px 0 0; padding: 0; list-style: none; font-family: ui-monospace, monospace; }
.log li { padding: 2px 0; border-bottom: 1px solid #20232a; }
code { font-family: ui-monospace, monospace; }
`;
```

`packages/srgb-effect-kit/src/devtools/ui/overlay.ts`:
```ts
import { h } from './dom';

/** SignalRGB shows only the top-left 320×200 of the page. */
export const VISIBLE_WIDTH = 320;
export const VISIBLE_HEIGHT = 200;

export interface OverlayState {
  /** Red lines just outside the visible area. */
  marker: boolean;
  /** Dims everything outside the visible area. */
  dim: boolean;
}

export interface AreaOverlay {
  readonly element: HTMLElement;
  update(state: OverlayState): void;
}

/**
 * The visible-area marker: a red line along x = 320 and one along y = 200, both outside the
 * visible pixels, and optional dimming of the rest of the page. Never intercepts pointer events.
 */
export function createAreaOverlay(): AreaOverlay {
  const part = (name: string, className: string, style: string) =>
    h('div', { 'data-srgb-devtools': name, class: className, style });
  const right = part(
    'area-right',
    'area-line',
    `left:${VISIBLE_WIDTH}px;top:0;width:1px;height:${VISIBLE_HEIGHT + 1}px`,
  );
  const bottom = part(
    'area-bottom',
    'area-line',
    `left:0;top:${VISIBLE_HEIGHT}px;width:${VISIBLE_WIDTH + 1}px;height:1px`,
  );
  const dimRight = part(
    'dim-right',
    'area-dim',
    `left:${VISIBLE_WIDTH + 1}px;top:0;right:0;bottom:0`,
  );
  const dimBottom = part(
    'dim-bottom',
    'area-dim',
    `left:0;top:${VISIBLE_HEIGHT + 1}px;width:${VISIBLE_WIDTH + 1}px;bottom:0`,
  );
  const element = h(
    'div',
    { class: 'area', 'data-srgb-devtools': 'area', 'aria-hidden': 'true' },
    dimRight,
    dimBottom,
    right,
    bottom,
  );
  return {
    element,
    update({ marker, dim }) {
      right.hidden = !marker;
      bottom.hidden = !marker;
      dimRight.hidden = !dim;
      dimBottom.hidden = !dim;
    },
  };
}
```

- [ ] **Step 3: Implement the drawer and mount it**

`packages/srgb-effect-kit/src/devtools/ui/drawer.ts`:
```ts
import type { DevtoolsContext } from '../context';
import { h } from './dom';
import { createAreaOverlay } from './overlay';
import { DEVTOOLS_CSS } from './styles';

/** Tag of the shadow host, appended to `<html>` so effect code that clears `<body>` keeps it. */
export const HOST_TAG = 'srgb-effect-devtools';
/** Smallest drawer height (bottom dock) or width (right dock), in CSS pixels. */
export const MIN_DRAWER_SIZE = 160;

export type Dock = 'bottom' | 'right';

/** Persisted drawer state. */
export interface DrawerState {
  open: boolean;
  dock: Dock;
  /** Height when docked bottom, width when docked right. */
  size: number;
  /** Id of the selected tab. */
  tab: string;
  /** Visible-area marker lines. */
  marker: boolean;
  /** Dimming outside the visible area. */
  dim: boolean;
}

export const DEFAULT_DRAWER_STATE: DrawerState = {
  open: false,
  dock: 'bottom',
  size: 320,
  tab: 'properties',
  marker: true,
  dim: false,
};

/** What a tab's `create()` returns. `show`/`hide` let tabs run work only while visible. */
export interface TabInstance {
  readonly element: HTMLElement;
  show?(): void;
  hide?(): void;
}

/** One drawer tab. `create` runs the first time the tab is shown. */
export interface TabDefinition {
  id: string;
  label: string;
  create(context: DevtoolsContext): TabInstance;
}

export interface DrawerHandle {
  readonly host: HTMLElement;
  readonly root: ShadowRoot;
  readonly state: Readonly<DrawerState>;
  open(): void;
  close(): void;
  toggle(): void;
  setDock(dock: Dock): void;
  setSize(size: number): void;
  select(tab: string): void;
  setOverlay(overlay: Partial<Pick<DrawerState, 'marker' | 'dim'>>): void;
  /** Shows `count` on the toggle button; hidden at 0. */
  setBadge(count: number): void;
}

const STORAGE_KEY = 'drawer';

export const isDrawerState = (value: unknown): value is DrawerState => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.open === 'boolean' &&
    (v.dock === 'bottom' || v.dock === 'right') &&
    typeof v.size === 'number' &&
    Number.isFinite(v.size) &&
    typeof v.tab === 'string' &&
    typeof v.marker === 'boolean' &&
    typeof v.dim === 'boolean'
  );
};

/** Clamps the drawer size between `MIN_DRAWER_SIZE` and 90% of the viewport along its dock axis. */
export function clampDrawerSize(
  size: number,
  dock: Dock,
  viewport: { width: number; height: number },
): number {
  const max = Math.max(
    MIN_DRAWER_SIZE,
    Math.floor(0.9 * (dock === 'bottom' ? viewport.height : viewport.width)),
  );
  return Math.min(max, Math.max(MIN_DRAWER_SIZE, Math.round(size)));
}

/**
 * Mounts the drawer: a shadow root holding the visible-area overlay, the toggle button and the
 * docked, resizable panel with one button per tab. State is persisted under `drawer`.
 */
export function mountDrawer(
  context: DevtoolsContext,
  tabs: readonly TabDefinition[],
): DrawerHandle {
  const { win, storage } = context;
  const viewport = () => ({ width: win.innerWidth, height: win.innerHeight });
  let state: DrawerState = { ...DEFAULT_DRAWER_STATE, ...storage.read(STORAGE_KEY, isDrawerState) };
  if (!tabs.some((tab) => tab.id === state.tab)) state.tab = tabs[0]?.id ?? state.tab;

  const host = win.document.createElement(HOST_TAG);
  // Covers the viewport without catching clicks; only the toggle and panel take pointer events.
  host.setAttribute(
    'style',
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block',
  );
  const root = host.attachShadow({ mode: 'open' });

  const overlay = createAreaOverlay();
  const badge = h('span', { class: 'badge', 'data-srgb-devtools': 'badge', hidden: true });
  const toggleButton = h(
    'button',
    {
      type: 'button',
      class: 'toggle',
      'data-srgb-devtools': 'toggle',
      title: 'SignalRGB devtools',
    },
    'SRGB',
    badge,
  );
  const tool = (name: string, label: string, title: string) =>
    h('button', { type: 'button', class: 'tool', 'data-srgb-devtools': name, title }, label);
  const markerButton = tool('marker', 'Area', 'Mark the visible 320×200 area');
  const dimButton = tool('dim', 'Dim', 'Dim everything outside the visible area');
  const dockButton = tool('dock', '', 'Move the drawer');
  const closeButton = tool('close', '×', 'Close');
  const tabBar = h('div', { class: 'tabs', role: 'tablist' });
  const content = h('div', { class: 'content', 'data-srgb-devtools': 'content' });
  const resize = h('div', { class: 'resize', 'data-srgb-devtools': 'resize' });
  const panel = h(
    'section',
    { class: 'panel', 'data-srgb-devtools': 'panel', hidden: true },
    resize,
    h(
      'header',
      { class: 'header' },
      tabBar,
      h('div', { class: 'tools' }, markerButton, dimButton, dockButton, closeButton),
    ),
    content,
  );
  root.append(h('style', {}, DEVTOOLS_CSS), overlay.element, panel, toggleButton);

  const buttons = new Map<string, HTMLButtonElement>();
  const instances = new Map<string, TabInstance>();
  let visible: TabInstance | undefined;

  const instanceFor = (id: string): TabInstance | undefined => {
    let instance = instances.get(id);
    if (instance) return instance;
    const definition = tabs.find((tab) => tab.id === id);
    if (!definition) return undefined;
    instance = definition.create(context);
    instance.element.hidden = true;
    instances.set(id, instance);
    content.append(instance.element);
    return instance;
  };

  const render = () => {
    panel.hidden = !state.open;
    toggleButton.hidden = state.open;
    panel.dataset.dock = state.dock;
    panel.style.setProperty('--size', `${state.size}px`);
    dockButton.textContent = state.dock === 'bottom' ? 'Dock right' : 'Dock bottom';
    markerButton.setAttribute('aria-pressed', String(state.marker));
    dimButton.setAttribute('aria-pressed', String(state.dim));
    overlay.update(state);
    for (const [id, button] of buttons)
      button.setAttribute('aria-selected', String(id === state.tab));
    const next = state.open ? instanceFor(state.tab) : undefined;
    if (next === visible) return;
    if (visible) {
      visible.element.hidden = true;
      visible.hide?.();
    }
    if (next) {
      next.element.hidden = false;
      next.show?.();
    }
    visible = next;
  };

  const update = (patch: Partial<DrawerState>) => {
    const next = { ...state, ...patch };
    state = { ...next, size: clampDrawerSize(next.size, next.dock, viewport()) };
    storage.write(STORAGE_KEY, state);
    render();
  };

  for (const tab of tabs) {
    const button = h(
      'button',
      { type: 'button', role: 'tab', class: 'tab', 'data-srgb-devtools-tab': tab.id },
      tab.label,
    );
    button.addEventListener('click', () => update({ tab: tab.id }));
    buttons.set(tab.id, button);
    tabBar.append(button);
  }

  toggleButton.addEventListener('click', () => update({ open: !state.open }));
  closeButton.addEventListener('click', () => update({ open: false }));
  dockButton.addEventListener('click', () =>
    update({ dock: state.dock === 'bottom' ? 'right' : 'bottom' }),
  );
  markerButton.addEventListener('click', () => update({ marker: !state.marker }));
  dimButton.addEventListener('click', () => update({ dim: !state.dim }));
  resize.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    resize.setPointerCapture?.(event.pointerId);
    const onMove = (move: PointerEvent) =>
      update({
        size:
          state.dock === 'bottom' ? win.innerHeight - move.clientY : win.innerWidth - move.clientX,
      });
    const onUp = () => {
      resize.removeEventListener('pointermove', onMove);
      resize.removeEventListener('pointerup', onUp);
    };
    resize.addEventListener('pointermove', onMove);
    resize.addEventListener('pointerup', onUp);
  });
  win.addEventListener('resize', () => update({}));

  state = { ...state, size: clampDrawerSize(state.size, state.dock, viewport()) };
  render();
  win.document.documentElement.append(host);

  return {
    host,
    root,
    get state() {
      return state;
    },
    open: () => update({ open: true }),
    close: () => update({ open: false }),
    toggle: () => update({ open: !state.open }),
    setDock: (dock) => update({ dock }),
    setSize: (size) => update({ size }),
    select: (tab) => update({ tab }),
    setOverlay: (overlayState) => update(overlayState),
    setBadge(count) {
      badge.hidden = count <= 0;
      badge.textContent = count > 99 ? '99+' : String(count);
    },
  };
}
```

`packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts`:
```ts
import type { TabDefinition } from '../drawer';

/** Drawer tabs, in display order. */
export const TABS: readonly TabDefinition[] = [];
```

`packages/srgb-effect-kit/src/devtools/ui/index.ts`:
```ts
import type { DevtoolsContext } from '../context';
import { mountDrawer, type DrawerHandle } from './drawer';
import { TABS } from './tabs';

/** Mounts the drawer with every tab. */
export function mountUi(context: DevtoolsContext): DrawerHandle {
  return mountDrawer(context, TABS);
}
```

In `packages/srgb-effect-kit/src/devtools/index.ts`, make these replacements:

1. Replace:

```ts
import { installConsoleCounter } from './consoleCounter';
import { installRendererSimulation } from './renderer';
```

with:

```ts
import { installConsoleCounter } from './consoleCounter';
import { onDomReady } from './lifecycle';
import { installRendererSimulation } from './renderer';
```

2. Replace:

```ts
import { createStorage } from './storage';
```

with:

```ts
import { createStorage } from './storage';
import { mountUi } from './ui';
```

3. Replace:

```ts
  rememberInstance(win, context);
  return context;
```

with:

```ts
  rememberInstance(win, context);
  // Registered after the simulation's, so the drawer mounts after the load-time handler calls.
  onDomReady(win, () => mountUi(context));
  return context;
```

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm --filter srgb-effect-kit test && pnpm --filter srgb-effect-kit typecheck && pnpm lint && pnpm format && pnpm build && CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e`
Expected: all PASS, with 7 e2e tests.

- [ ] **Step 5: Look at it**

Run: `pnpm --filter @srgb-effect-kit-examples/basic-2d dev`.
Expected:
- a red line runs along the right and bottom edges of the 320×200 rainbow;
- "SRGB" sits bottom-right; clicking it opens an empty dark panel at the bottom;
- "Dock right" moves the panel; dragging its edge resizes it;
- "Dim" darkens everything outside 320×200;
- after a reload, the open state, dock and size are kept.

- [ ] **Step 6: Commit**

```bash
git add packages/srgb-effect-kit/src/devtools e2e
git commit -m "feat(devtools): add the drawer shell and visible-area marker" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 7: Properties tab

**Files:**
- Create: `packages/srgb-effect-kit/src/devtools/ui/tabs/properties.ts`
- Modify: `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts`, `e2e/devtools.spec.ts`
- Test: `packages/srgb-effect-kit/src/devtools/ui/tabs/properties.test.ts`

**Interfaces:**
- Consumes:
  - From Task 1: `PropertyController` (`definitions`, `get`, `set`, `reset`, `subscribe`), `propertyRange`, `RawValue`.
  - From Task 6: `h`, `TabDefinition`, `TabInstance`.
- Produces:
  - `hueGradient(min, max): string`
  - `interface PropertyControl { input; value; update(value) }`
  - `createControl(p, initial, onChange)`
  - `createPropertiesTab(context): TabInstance`
  - `propertiesTab: TabDefinition`, with `id: 'properties'` and `label: 'Properties'`

DOM contract:
- **Rows:** one `[data-srgb-property=<name>]` row per property, in manifest order. Each row has three parts:
  - a `<label>` with the label text (and `title` = tooltip);
  - the control `[data-srgb-control=<name>]`;
  - an `<output class=value>`, which shows the value for number, hue and color.
- **Controls:**

  | Type | Control | Event that sets the value |
  |---|---|---|
  | `number` | `<input type=range step=1>` | `input` |
  | `hue` | the same range input, plus class `hue` and `--track` set to `hueGradient(min, max)` | `input` |
  | `boolean` | checkbox | `change` |
  | `color` | `<input type=color>` | `input` |
  | `textfield` | `<input type=text>` | `input` (every keystroke) |
  | `list` | `<select>` | `change` |

  Every change calls `properties.set(name, value)`.
- **Reset:** `[data-srgb-devtools=reset-properties]` calls `properties.reset()`.
- **Sync:** controls follow changes made elsewhere through `properties.subscribe`.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/devtools/ui/tabs/properties.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../../../test/helpers/devtools';
import type { DevtoolsContext } from '../../context';
import { createPropertyController } from '../../properties';
import { createStorage } from '../../storage';
import { createPropertiesTab, hueGradient } from './properties';

const globals = window as unknown as Record<string, unknown>;

const mount = () => {
  const storage = createStorage(MANIFEST.title, () => localStorage);
  const properties = createPropertyController(MANIFEST.properties, storage, window);
  const tab = createPropertiesTab({ properties } as DevtoolsContext);
  document.body.append(tab.element);
  const control = <T extends HTMLElement = HTMLInputElement>(name: string) =>
    tab.element.querySelector<T>(`[data-srgb-control="${name}"]`)!;
  return { tab, properties, control };
};

/** Sets an input's value the way a user would and dispatches `type`. */
const input = (element: HTMLInputElement | HTMLSelectElement, value: string, type = 'input') => {
  element.value = value;
  element.dispatchEvent(new Event(type, { bubbles: true }));
};

beforeEach(() => {
  resetDevtoolsWindow();
  vi.stubGlobal('reportError', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('Properties tab', () => {
  it('renders one row per property in manifest order, with the matching control', () => {
    const { tab, control } = mount();
    const rows = [...tab.element.querySelectorAll<HTMLElement>('[data-srgb-property]')];
    expect(rows.map((row) => row.dataset.srgbProperty)).toEqual([
      'speed',
      'baseHue',
      'rainbow',
      'tint',
      'text',
      'mode',
    ]);
    expect(rows[0]!.querySelector('label')!.textContent).toBe('Speed');
    expect(control('speed')).toMatchObject({ type: 'range', min: '0', max: '100', value: '50' });
    expect(control('baseHue')).toMatchObject({ type: 'range', min: '0', max: '360', value: '120' });
    expect(control('baseHue').classList.contains('hue')).toBe(true);
    expect(control('baseHue').style.getPropertyValue('--track')).toBe(hueGradient(0, 360));
    expect(control('rainbow')).toMatchObject({ type: 'checkbox', checked: true });
    expect(control('tint')).toMatchObject({ type: 'color', value: '#009bde' });
    expect(control('text')).toMatchObject({ type: 'text', value: '' });
    const mode = control<HTMLSelectElement>('mode');
    expect([...mode.options].map((option) => option.value)).toEqual(['Wave', 'Pulse']);
    expect(mode.value).toBe('Wave');
  });

  it('sets globals in raw format and calls the handler on change', () => {
    const { control } = mount();
    const calls: unknown[] = [];
    globals.onSpeedChanged = () => calls.push(globals.speed);
    globals.onRainbowChanged = () => calls.push(globals.rainbow);
    globals.onTextChanged = () => calls.push(globals.text);
    globals.onModeChanged = () => calls.push(globals.mode);

    input(control('speed'), '80');
    const rainbow = control('rainbow');
    rainbow.checked = false;
    rainbow.dispatchEvent(new Event('change'));
    input(control('text'), 'h');
    input(control('text'), 'hi');
    input(control<HTMLSelectElement>('mode'), 'Pulse', 'change');
    expect(calls).toEqual([80, '0', 'h', 'hi', 'Pulse']);
  });

  it('shows the current number value next to the slider', () => {
    const { tab, control } = mount();
    input(control('speed'), '42');
    expect(tab.element.querySelector('[data-srgb-property="speed"] output')!.textContent).toBe(
      '42',
    );
  });

  it('resets every control and global to the defaults', () => {
    const { tab, control } = mount();
    input(control('speed'), '80');
    input(control<HTMLSelectElement>('mode'), 'Pulse', 'change');
    tab.element
      .querySelector<HTMLButtonElement>('[data-srgb-devtools="reset-properties"]')!
      .click();
    expect(globals.speed).toBe(50);
    expect(globals.mode).toBe('Wave');
    expect(control('speed').value).toBe('50');
    expect(control<HTMLSelectElement>('mode').value).toBe('Wave');
  });

  it('renders labels and list values as text', () => {
    const storage = createStorage('X', () => localStorage);
    const properties = createPropertyController(
      [
        {
          property: 'odd',
          type: 'list',
          label: '<img src=x onerror=alert(1)>',
          values: ['<b>', 'a&b'],
          default: '<b>',
        },
      ],
      storage,
      window,
    );
    const { element } = createPropertiesTab({ properties } as DevtoolsContext);
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('label')!.textContent).toBe('<img src=x onerror=alert(1)>');
    expect([...element.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      '<b>',
      'a&b',
    ]);
  });
});

describe('hueGradient', () => {
  it('spans the property range in six steps', () => {
    expect(hueGradient(0, 360)).toBe(
      'linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))',
    );
    expect(hueGradient(100, 160)).toContain('hsl(110 100% 50%)');
  });
});
```

Append to `e2e/devtools.spec.ts`:
```ts
test('controls set the globals and call the change handler', async ({ page }) => {
  await recordHandlerCalls(page, ['onBaseHueChanged']);
  await openEffect(page);
  await page.locator('[data-srgb-devtools="toggle"]').click();
  await page.locator('[data-srgb-control="speed"]').fill('80');
  await page.locator('[data-srgb-control="baseHue"]').fill('10');
  await page.locator('[data-srgb-control="rainbow"]').uncheck();
  await page.locator('[data-srgb-control="mode"]').selectOption('Pulse');
  expect(
    await page.evaluate(() => [window.speed, window.baseHue, window.rainbow, window.mode]),
  ).toEqual([80, 10, '0', 'Pulse']);
  await expect
    .poll(() => page.evaluate(() => window.__handlerCalls))
    .toEqual(['onBaseHueChanged', 'onBaseHueChanged']);
});

test('keeps property values and drawer state across reloads', async ({ page }) => {
  await openEffect(page);
  await page.locator('[data-srgb-devtools="toggle"]').click();
  await page.locator('[data-srgb-control="speed"]').fill('80');
  await page.locator('[data-srgb-control="mode"]').selectOption('Pulse');
  await page.reload();
  await page.locator('[data-srgb-devtools="panel"]').waitFor();
  expect(await page.evaluate(() => [window.speed, window.mode])).toEqual([80, 'Pulse']);
  await expect(page.locator('[data-srgb-control="speed"]')).toHaveValue('80');
  await page.locator('[data-srgb-devtools="reset-properties"]').click();
  expect(await page.evaluate(() => window.speed)).toBe(25);
});
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools/ui`
Expected: FAIL, because `./properties` cannot be resolved.

- [ ] **Step 2: Implement and register the tab**

`packages/srgb-effect-kit/src/devtools/ui/tabs/properties.ts`:
```ts
import type { PropertyDef } from '../../../shared';
import type { DevtoolsContext } from '../../context';
import { propertyRange, type RawValue } from '../../properties';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

/** CSS gradient across the hues from `min` to `max`, for a hue slider's track. */
export function hueGradient(min: number, max: number): string {
  const stops = Array.from({ length: 7 }, (_, i) => `hsl(${min + ((max - min) * i) / 6} 100% 50%)`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** A property's input, the text shown in the row's value column, and a silent updater. */
export interface PropertyControl {
  readonly input: HTMLInputElement | HTMLSelectElement;
  readonly value: HTMLElement;
  /** Shows `value` without dispatching events. */
  update(value: RawValue): void;
}

/**
 * Builds the input for one property: a slider for number and hue (hue with a hue-gradient track),
 * a checkbox for boolean, a color picker, a text input that reports every keystroke, and a select
 * for list. `onChange` receives the input's value (a string, or a boolean for checkboxes).
 */
export function createControl(
  p: PropertyDef,
  initial: RawValue,
  onChange: (value: string | boolean) => void,
): PropertyControl {
  const attrs = { id: `srgb-property-${p.property}`, 'data-srgb-control': p.property };
  const value = h('output', { class: 'value', for: attrs.id });
  let input: HTMLInputElement | HTMLSelectElement;
  switch (p.type) {
    case 'number':
    case 'hue': {
      const [min, max] = propertyRange(p);
      input = h('input', { ...attrs, type: 'range', min, max, step: 1 });
      if (p.type === 'hue') {
        input.classList.add('hue');
        input.style.setProperty('--track', hueGradient(min, max));
      }
      input.addEventListener('input', () => onChange(input.value));
      break;
    }
    case 'boolean': {
      const checkbox = h('input', { ...attrs, type: 'checkbox' });
      checkbox.addEventListener('change', () => onChange(checkbox.checked));
      input = checkbox;
      break;
    }
    case 'color':
    case 'textfield':
      input = h('input', { ...attrs, type: p.type === 'color' ? 'color' : 'text' });
      // `input` fires per keystroke for text and continuously while picking a color.
      input.addEventListener('input', () => onChange(input.value));
      break;
    case 'list':
      input = h(
        'select',
        attrs,
        ...p.values.map((option) => h('option', { value: option }, option)),
      );
      input.addEventListener('change', () => onChange(input.value));
      break;
  }
  const update = (next: RawValue) => {
    if (input instanceof HTMLInputElement && input.type === 'checkbox')
      input.checked = next === '1';
    else input.value = String(next);
    value.textContent =
      p.type === 'number' || p.type === 'hue' || p.type === 'color' ? String(next) : '';
  };
  update(initial);
  return { input, value, update };
}

/** The Properties tab: one row per property in manifest order, plus "Reset to defaults". */
export function createPropertiesTab({ properties }: DevtoolsContext): TabInstance {
  const controls = new Map<string, PropertyControl>();
  const rows = properties.definitions.map((p) => {
    const control = createControl(p, properties.get(p.property)!, (value) =>
      properties.set(p.property, value),
    );
    controls.set(p.property, control);
    return h(
      'div',
      { class: 'row', 'data-srgb-property': p.property },
      h('label', { for: control.input.id, title: p.tooltip }, p.label),
      control.input,
      control.value,
    );
  });
  // Keeps controls in sync with changes made elsewhere (reset, or another control's handler).
  properties.subscribe((name, value) => controls.get(name)?.update(value));

  const reset = h(
    'button',
    { type: 'button', class: 'button', 'data-srgb-devtools': 'reset-properties' },
    'Reset to defaults',
  );
  reset.addEventListener('click', () => properties.reset());

  const element = h(
    'div',
    { 'data-srgb-devtools': 'properties' },
    rows.length > 0
      ? h('div', { class: 'rows' }, ...rows)
      : h('p', { class: 'note' }, 'This effect declares no properties.'),
    h('div', { class: 'actions' }, reset),
    h(
      'p',
      { class: 'note' },
      'Changes set the global, then call window.on<Property>Changed() with no arguments, like SignalRGB.',
    ),
  );
  return { element };
}

export const propertiesTab: TabDefinition = {
  id: 'properties',
  label: 'Properties',
  create: createPropertiesTab,
};
```

Replace `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts` with:
```ts
import type { TabDefinition } from '../drawer';
import { propertiesTab } from './properties';

/** Drawer tabs, in display order. */
export const TABS: readonly TabDefinition[] = [propertiesTab];
```

- [ ] **Step 3: Run the tests and checks**

Run: `pnpm --filter srgb-effect-kit test && pnpm --filter srgb-effect-kit typecheck && pnpm lint && pnpm format && pnpm build && CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e`
Expected: all PASS, with 9 e2e tests.

- [ ] **Step 4: Commit**

```bash
git add packages/srgb-effect-kit/src/devtools e2e
git commit -m "feat(devtools): add the Properties tab" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Audio controller and Audio tab

**Files:**
- Create: `packages/srgb-effect-kit/src/devtools/audioController.ts`, `packages/srgb-effect-kit/src/devtools/ui/tabs/audio.ts`
- Modify: `packages/srgb-effect-kit/src/devtools/{context,index}.ts`, `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts`, `e2e/devtools.spec.ts`
- Test: `packages/srgb-effect-kit/src/devtools/audioController.test.ts`, `packages/srgb-effect-kit/src/devtools/ui/tabs/audio.test.ts`

**Interfaces:**
- Consumes:
  - From Task 4: `AudioFrame`, `analyserFrame`, `randomFrame`, `silentFrame`, `writeAudioFrame`.
  - From Task 1: `MockAudio`, `DevtoolsStorage`, `FrameScheduler`.
  - From Task 6: `h`, `TabDefinition`.
- Produces:
  - **`audioController.ts`:**
    - `type AudioMode = 'silent' | 'random' | 'microphone' | 'system'`
    - `AUDIO_MODES`
    - `interface AudioSource { read(): AudioFrame; stop(): void }`
    - `type OpenAudioCapture = (kind, onEnded) => Promise<AudioSource>`
    - `interface AudioController { mode; error; setMode(mode): Promise<void>; subscribe }`
    - `createAudioController(audio, storage, raf, openCapture)`
    - `openAudioCapture(kind, onEnded, media?)`
  - **`ui/tabs/audio.ts`:** `formatLevel(level)`, `createAudioTab(context)`, and `audioTab` (`id: 'audio'`).
  - **`DevtoolsContext`** gains `audio`.

Behaviour:
- **Silent** writes `level -100`, `width 0`, `density 0` and zero bands.
- **Random** writes a fresh `randomFrame()` on every native animation frame.
- **Microphone** uses `getUserMedia` with echo cancellation, noise suppression and auto gain off.
- **System** uses `getDisplayMedia({ audio: true, video: true })`; the user must tick "Share audio".
- **A failed or empty capture** falls back to silent, and `error` holds the message.
- **When sharing stops**, the mode goes back to silent.
- **Persistence:** only `silent` and `random` are persisted and restored, because capture needs a user gesture.
- **Races:** a capture that resolves after a newer `setMode()` is stopped and dropped.

DOM contract:
- **Mode buttons:** `[data-srgb-audio-mode=<mode>]`, with `aria-pressed`.
- **Error:** `[data-srgb-devtools=audio-error]`, hidden when there is none.
- **Readouts:** `[data-srgb-devtools=audio-level|audio-width|audio-density]` with bars, plus a `canvas[data-srgb-devtools=audio-spectrum]` (400×80). They refresh on every native frame, only while the tab is shown.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/devtools/audioController.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioFrame } from './audio';
import { createAudioController, type AudioSource, type OpenAudioCapture } from './audioController';
import type { FrameScheduler } from './context';
import { createEngineMock } from './engine';
import { createStorage } from './storage';

const KEY = 'srgb-effect-kit:Audio Test:audio';

/** A rAF that only runs when `tick()` is called. */
const fakeRaf = () => {
  let queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  const raf: FrameScheduler = {
    request: (callback) => {
      queue.set(nextId, callback);
      return nextId++;
    },
    cancel: (id) => void queue.delete(id),
  };
  const tick = () => {
    const callbacks = queue;
    queue = new Map();
    for (const callback of callbacks.values()) callback(0);
  };
  return { raf, tick, pending: () => queue.size };
};

const frame = (level: number): AudioFrame => ({ level, width: 0.5, density: 0.5, freq: [9] });

const setup = (openCapture: OpenAudioCapture = vi.fn()) => {
  const { audio } = createEngineMock();
  const { raf, tick, pending } = fakeRaf();
  const controller = createAudioController(
    audio,
    createStorage('Audio Test', () => localStorage),
    raf,
    openCapture,
  );
  return { audio, controller, tick, pending };
};

beforeEach(() => localStorage.clear());

describe('createAudioController', () => {
  it('starts silent', () => {
    const { audio, controller, pending } = setup();
    expect(controller.mode).toBe('silent');
    expect(audio.level).toBe(-100);
    expect(pending()).toBe(0);
  });

  it('writes random frames every animation frame, in place', async () => {
    const { audio, controller, tick } = setup();
    const freq = audio.freq;
    await controller.setMode('random');
    expect(audio.level).toBeGreaterThanOrEqual(-60);
    const first = [...audio.freq];
    tick();
    expect(audio.freq).toBe(freq);
    expect(audio.freq).not.toEqual(first);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ mode: 'random' });
  });

  it('stops the loop and writes silence when switching back to silent', async () => {
    const { audio, controller, tick, pending } = setup();
    await controller.setMode('random');
    await controller.setMode('silent');
    tick();
    expect(pending()).toBe(0);
    expect(audio.level).toBe(-100);
    expect(audio.freq.every((band) => band === 0)).toBe(true);
  });

  it('restores random from storage', () => {
    localStorage.setItem(KEY, JSON.stringify({ mode: 'random' }));
    const { controller, audio } = setup();
    expect(controller.mode).toBe('random');
    expect(audio.level).toBeGreaterThan(-100);
  });

  it('does not restore capture modes, which need a user gesture', () => {
    localStorage.setItem(KEY, JSON.stringify({ mode: 'system' }));
    const open = vi.fn();
    expect(setup(open).controller.mode).toBe('silent');
    expect(open).not.toHaveBeenCalled();
  });

  it('runs a capture source and stops it on the next mode change', async () => {
    const source: AudioSource = { read: () => frame(-12), stop: vi.fn() };
    const { audio, controller, tick } = setup(async () => source);
    await controller.setMode('microphone');
    expect(controller.mode).toBe('microphone');
    expect(audio.level).toBe(-12);
    tick();
    await controller.setMode('silent');
    expect(source.stop).toHaveBeenCalledOnce();
  });

  it('falls back to silent with an error when capture fails', async () => {
    const { audio, controller } = setup(async () => {
      throw new Error('Permission denied');
    });
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.setMode('system');
    expect(controller.mode).toBe('silent');
    expect(controller.error).toBe('Permission denied');
    expect(audio.level).toBe(-100);
    expect(listener).toHaveBeenCalled();
    await controller.setMode('random');
    expect(controller.error).toBeUndefined();
  });

  it('goes silent when the user stops sharing', async () => {
    let ended = () => {};
    const { controller } = setup(async (_kind, onEnded) => {
      ended = onEnded;
      return { read: () => frame(-6), stop: vi.fn() };
    });
    await controller.setMode('system');
    ended();
    await Promise.resolve();
    expect(controller.mode).toBe('silent');
  });

  it('drops a capture that resolves after a newer mode was chosen', async () => {
    let resolve: (source: AudioSource) => void = () => {};
    const source: AudioSource = { read: () => frame(-3), stop: vi.fn() };
    const { audio, controller } = setup(() => new Promise<AudioSource>((done) => (resolve = done)));
    const pending = controller.setMode('system');
    await controller.setMode('random');
    resolve(source);
    await pending;
    expect(source.stop).toHaveBeenCalledOnce();
    expect(controller.mode).toBe('random');
    expect(audio.level).not.toBe(-3);
  });
});
```

`packages/srgb-effect-kit/src/devtools/ui/tabs/audio.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioController, AudioMode } from '../../audioController';
import type { DevtoolsContext } from '../../context';
import { createEngineMock } from '../../engine';
import { createAudioTab, formatLevel } from './audio';

const fakeAudio = () => {
  const listeners = new Set<() => void>();
  const state: { mode: AudioMode; error: string | undefined } = {
    mode: 'silent',
    error: undefined,
  };
  const controller: AudioController = {
    get mode() {
      return state.mode;
    },
    get error() {
      return state.error;
    },
    setMode: vi.fn(async (mode: AudioMode) => {
      state.mode = mode;
      for (const listener of listeners) listener();
    }),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { controller, state, notify: () => listeners.forEach((listener) => listener()) };
};

const mount = () => {
  const audio = fakeAudio();
  const engine = createEngineMock();
  const frames: FrameRequestCallback[] = [];
  const raf = { request: vi.fn((cb: FrameRequestCallback) => frames.push(cb)), cancel: vi.fn() };
  const tab = createAudioTab({
    audio: audio.controller,
    engine,
    raf,
  } as unknown as DevtoolsContext);
  const button = (mode: AudioMode) =>
    tab.element.querySelector<HTMLButtonElement>(`[data-srgb-audio-mode="${mode}"]`)!;
  const text = (name: string) =>
    tab.element.querySelector(`[data-srgb-devtools="${name}"]`)!.textContent;
  return { tab, audio, engine, raf, frames, button, text };
};

beforeEach(() => {
  // jsdom has no canvas implementation; the tab must cope with a null context.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('Audio tab', () => {
  it('shows one button per mode and marks the active one', async () => {
    const { button, audio } = mount();
    expect(button('silent').getAttribute('aria-pressed')).toBe('true');
    button('random').click();
    expect(audio.controller.setMode).toHaveBeenCalledWith('random');
    await Promise.resolve();
    expect(button('random').getAttribute('aria-pressed')).toBe('true');
    expect(button('silent').getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the capture error', () => {
    const { tab, audio } = mount();
    audio.state.error = 'No audio was shared.';
    audio.notify();
    const error = tab.element.querySelector<HTMLElement>('[data-srgb-devtools="audio-error"]')!;
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe('No audio was shared.');
  });

  it('refreshes the readouts every frame only while shown', () => {
    const { tab, engine, raf, frames, text } = mount();
    expect(raf.request).not.toHaveBeenCalled();
    engine.audio.level = -12.34;
    engine.audio.width = 0.5;
    tab.show!();
    expect(text('audio-level')).toBe('-12.3 dB');
    expect(text('audio-width')).toBe('0.50');
    expect(frames).toHaveLength(1);
    tab.hide!();
    expect(raf.cancel).toHaveBeenCalledOnce();
  });

  it('formats levels in dB', () => {
    expect(formatLevel(-100)).toBe('-100.0 dB');
    expect(formatLevel(0)).toBe('0.0 dB');
  });
});
```

Append to `e2e/devtools.spec.ts`:
```ts
test('the random audio mock writes engine.audio', async ({ page }) => {
  await openEffect(page);
  expect(await page.evaluate(() => window.engine.audio.level)).toBe(-100);
  await page.locator('[data-srgb-devtools="toggle"]').click();
  await page.locator('[data-srgb-devtools-tab="audio"]').click();
  await page.locator('[data-srgb-audio-mode="random"]').click();
  await expect.poll(() => page.evaluate(() => window.engine.audio.level)).toBeGreaterThan(-100);
  expect(await page.evaluate(() => window.engine.audio.freq.length)).toBe(200);
});
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools`
Expected: FAIL. `./audioController` and `./audio` cannot be resolved.

- [ ] **Step 2: Implement the controller and wire it into the bootstrap**

`packages/srgb-effect-kit/src/devtools/audioController.ts`:
```ts
import { analyserFrame, randomFrame, silentFrame, writeAudioFrame, type AudioFrame } from './audio';
import type { FrameScheduler } from './context';
import type { MockAudio } from './engine';
import type { DevtoolsStorage } from './storage';

/** Where `engine.audio` comes from. */
export type AudioMode = 'silent' | 'random' | 'microphone' | 'system';
export const AUDIO_MODES: readonly AudioMode[] = ['silent', 'random', 'microphone', 'system'];

/** A live audio input that produces one frame per call. */
export interface AudioSource {
  read(): AudioFrame;
  stop(): void;
}

/**
 * Opens a capture source; `openAudioCapture` in browsers, a fake in tests. `onEnded` runs when the
 * user stops sharing.
 */
export type OpenAudioCapture = (
  kind: 'microphone' | 'system',
  onEnded: () => void,
) => Promise<AudioSource>;

export interface AudioController {
  readonly mode: AudioMode;
  /** Message of the last failed capture attempt, cleared by the next mode change. */
  readonly error: string | undefined;
  /**
   * Switches the source. Capture modes ask for permission; on failure the mode falls back to
   * `silent` and `error` explains why. Resolves once the new mode is running.
   */
  setMode(mode: AudioMode): Promise<void>;
  subscribe(listener: () => void): () => void;
}

const STORAGE_KEY = 'audio';
/** Capture modes need a user gesture, so only these survive a reload. */
const RESTORABLE: readonly AudioMode[] = ['silent', 'random'];

const isStoredAudio = (value: unknown): value is { mode: AudioMode } =>
  typeof value === 'object' &&
  value !== null &&
  RESTORABLE.includes((value as { mode?: AudioMode }).mode as AudioMode);

/**
 * Drives `engine.audio` from the selected mode, once per native animation frame (SignalRGB updates
 * audio independently of the effect's frame rate). Restores `silent` or `random` from storage.
 */
export function createAudioController(
  audio: MockAudio,
  storage: DevtoolsStorage,
  raf: FrameScheduler,
  openCapture: OpenAudioCapture,
): AudioController {
  let mode: AudioMode = 'silent';
  let error: string | undefined;
  let source: AudioSource | undefined;
  let frameId: number | undefined;
  let generation = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const stop = () => {
    if (frameId !== undefined) raf.cancel(frameId);
    frameId = undefined;
    source?.stop();
    source = undefined;
  };
  const run = (next: AudioSource) => {
    source = next;
    const frame = () => {
      writeAudioFrame(audio, next.read());
      frameId = raf.request(frame);
    };
    frame();
  };

  const setMode = async (next: AudioMode) => {
    const current = (generation += 1);
    stop();
    error = undefined;
    mode = next;
    if (RESTORABLE.includes(next)) storage.write(STORAGE_KEY, { mode: next });
    if (next === 'silent') writeAudioFrame(audio, silentFrame());
    else if (next === 'random') run({ read: () => randomFrame(), stop: () => {} });
    notify();
    if (next !== 'microphone' && next !== 'system') return;

    try {
      const capture = await openCapture(next, () => {
        if (current === generation) void setMode('silent');
      });
      // A newer setMode() call won the race: drop this capture.
      if (current !== generation) {
        capture.stop();
        return;
      }
      run(capture);
    } catch (reason) {
      if (current !== generation) return;
      error = reason instanceof Error ? reason.message : String(reason);
      mode = 'silent';
      writeAudioFrame(audio, silentFrame());
    }
    notify();
  };

  const stored = storage.read(STORAGE_KEY, isStoredAudio);
  if (stored) void setMode(stored.mode);

  return {
    get mode() {
      return mode;
    },
    get error() {
      return error;
    },
    setMode,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Captures the microphone (`getUserMedia`) or system/tab audio (`getDisplayMedia`, with "Share
 * audio" ticked) and analyses it per frame: stereo time-domain samples for level and width, and
 * byte frequency data (fftSize 512) for the 200 bands and density. `onEnded` runs when the user
 * stops sharing.
 * @throws Error when permission is denied or no audio track was shared.
 */
export async function openAudioCapture(
  kind: 'microphone' | 'system',
  onEnded: () => void,
  media: MediaDevices = navigator.mediaDevices,
): Promise<AudioSource> {
  const stream =
    kind === 'microphone'
      ? await media.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        })
      : await media.getDisplayMedia({ audio: true, video: true });
  const stopStream = () => {
    for (const track of stream.getTracks()) track.stop();
  };
  const [track] = stream.getAudioTracks();
  if (!track) {
    stopStream();
    throw new Error('No audio was shared. Pick a tab or screen and tick "Share audio".');
  }

  const context = new AudioContext();
  void context.resume();
  const input = context.createMediaStreamSource(new MediaStream([track]));
  const splitter = context.createChannelSplitter(2);
  const left = context.createAnalyser();
  const right = context.createAnalyser();
  const mixed = context.createAnalyser();
  left.fftSize = 1024;
  right.fftSize = 1024;
  mixed.fftSize = 512;
  mixed.smoothingTimeConstant = 0.8;
  input.connect(splitter);
  splitter.connect(left, 0);
  splitter.connect(right, 1);
  input.connect(mixed);

  const leftSamples = new Float32Array(left.fftSize);
  const rightSamples = new Float32Array(right.fftSize);
  const spectrum = new Uint8Array(mixed.frequencyBinCount);
  const mono = track.getSettings().channelCount === 1;
  track.addEventListener('ended', onEnded);

  return {
    read() {
      left.getFloatTimeDomainData(leftSamples);
      right.getFloatTimeDomainData(rightSamples);
      mixed.getByteFrequencyData(spectrum);
      return analyserFrame({ left: leftSamples, right: rightSamples, spectrum, mono });
    },
    stop() {
      input.disconnect();
      stopStream();
      void context.close();
    },
  };
}
```

In `packages/srgb-effect-kit/src/devtools/context.ts`, make these replacements:

1. Replace:

```ts
import type { DevtoolsConfig } from '../shared';
```

with:

```ts
import type { DevtoolsConfig } from '../shared';
import type { AudioController } from './audioController';
```

2. Replace:

```ts
  readonly consoleCounter: ConsoleCounter;
}
```

with:

```ts
  readonly consoleCounter: ConsoleCounter;
  readonly audio: AudioController;
}
```

In `packages/srgb-effect-kit/src/devtools/index.ts`, make these replacements:

1. Replace:

```ts
import type { DevtoolsConfig } from '../shared';
```

with:

```ts
import type { DevtoolsConfig } from '../shared';
import { createAudioController, openAudioCapture } from './audioController';
```

2. Replace:

```ts
  const simulation = startSimulation(config, win, storage, hot);
```

with:

```ts
  const simulation = startSimulation(config, win, storage, hot);
  const { engine } = simulation;
  const audio = createAudioController(engine.audio, storage, raf, openAudioCapture);
```

3. Replace:

```ts
    consoleCounter,
  };
```

with:

```ts
    consoleCounter,
    audio,
  };
```

- [ ] **Step 3: Implement and register the tab**

`packages/srgb-effect-kit/src/devtools/ui/tabs/audio.ts`:
```ts
import { AUDIO_MODES, type AudioMode } from '../../audioController';
import type { DevtoolsContext } from '../../context';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

const LABELS: Record<AudioMode, string> = {
  silent: 'Silent',
  random: 'Random',
  microphone: 'Microphone',
  system: 'System audio',
};

/** Readout text for the current `engine.audio`, e.g. `-12.3 dB`. */
export const formatLevel = (level: number): string => `${level.toFixed(1)} dB`;

/**
 * The Audio tab: one button per mode (`data-srgb-audio-mode`), the last capture error, live
 * level/width/density readouts and a 200-band spectrum, refreshed every native frame while shown.
 */
export function createAudioTab({ audio, engine, raf }: DevtoolsContext): TabInstance {
  const buttons = AUDIO_MODES.map((mode) => {
    const button = h(
      'button',
      { type: 'button', 'data-srgb-audio-mode': mode, 'aria-pressed': 'false' },
      LABELS[mode],
    );
    button.addEventListener('click', () => void audio.setMode(mode));
    return button;
  });
  const error = h('p', { class: 'error', 'data-srgb-devtools': 'audio-error', hidden: true });
  const level = h('output', { class: 'value', 'data-srgb-devtools': 'audio-level' });
  const width = h('output', { class: 'value', 'data-srgb-devtools': 'audio-width' });
  const density = h('output', { class: 'value', 'data-srgb-devtools': 'audio-density' });
  const bar = (fill: HTMLElement) => h('div', { class: 'bar' }, fill);
  const levelFill = h('span');
  const widthFill = h('span');
  const densityFill = h('span');
  const spectrum = h('canvas', {
    class: 'preview',
    width: 400,
    height: 80,
    'data-srgb-devtools': 'audio-spectrum',
  });

  const renderMode = () => {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.srgbAudioMode === audio.mode));
    }
    error.hidden = audio.error === undefined;
    error.textContent = audio.error ?? '';
  };
  audio.subscribe(renderMode);
  renderMode();

  let frameId: number | undefined;
  const draw = () => {
    const { level: dB, width: w, density: d, freq } = engine.audio;
    level.textContent = formatLevel(dB);
    width.textContent = w.toFixed(2);
    density.textContent = d.toFixed(2);
    levelFill.style.width = `${Math.max(0, dB + 100)}%`;
    widthFill.style.width = `${w * 100}%`;
    densityFill.style.width = `${d * 100}%`;
    const ctx = spectrum.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f1115';
      ctx.fillRect(0, 0, spectrum.width, spectrum.height);
      ctx.fillStyle = '#4c8dff';
      const barWidth = spectrum.width / freq.length;
      freq.forEach((band, i) => {
        const height = (Math.min(255, Math.max(0, band)) / 255) * spectrum.height;
        ctx.fillRect(i * barWidth, spectrum.height - height, Math.max(1, barWidth - 0.5), height);
      });
    }
    frameId = raf.request(draw);
  };

  const element = h(
    'div',
    { 'data-srgb-devtools': 'audio' },
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Audio source' }, ...buttons),
    error,
    h(
      'div',
      { class: 'rows' },
      h('div', { class: 'row' }, h('span', {}, 'level'), bar(levelFill), level),
      h('div', { class: 'row' }, h('span', {}, 'width'), bar(widthFill), width),
      h('div', { class: 'row' }, h('span', {}, 'density'), bar(densityFill), density),
    ),
    spectrum,
    h(
      'p',
      { class: 'note' },
      'Writes engine.audio every frame. System audio uses screen sharing: pick a tab or screen and tick "Share audio".',
    ),
  );

  return {
    element,
    show() {
      if (frameId === undefined) draw();
    },
    hide() {
      if (frameId !== undefined) raf.cancel(frameId);
      frameId = undefined;
    },
  };
}

export const audioTab: TabDefinition = { id: 'audio', label: 'Audio', create: createAudioTab };
```

Replace `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts` with:
```ts
import type { TabDefinition } from '../drawer';
import { audioTab } from './audio';
import { propertiesTab } from './properties';

/** Drawer tabs, in display order. */
export const TABS: readonly TabDefinition[] = [propertiesTab, audioTab];
```

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm --filter srgb-effect-kit test && pnpm --filter srgb-effect-kit typecheck && pnpm lint && pnpm format && pnpm build && CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e`
Expected: all PASS, with 10 e2e tests.

Then run `pnpm --filter @srgb-effect-kit-examples/audio-visualizer dev` and open it.
Expected: in Audio → Random the bars move. In "System audio", sharing a tab that plays music with "Share audio" ticked drives the bars; stopping the share returns the mode to Silent.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/devtools e2e
git commit -m "feat(devtools): mock engine.audio with silent, random, microphone and system audio" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 9: Screen controller, Screen tab and Meters tab

**Files:**
- Create: `packages/srgb-effect-kit/src/devtools/screenController.ts`, `packages/srgb-effect-kit/src/devtools/ui/tabs/{screen,meters}.ts`
- Modify: `packages/srgb-effect-kit/src/devtools/{context,index}.ts`, `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts`
- Test: `packages/srgb-effect-kit/src/devtools/screenController.test.ts`, `packages/srgb-effect-kit/src/devtools/ui/tabs/{screen,meters}.test.ts`

**Interfaces:**
- Consumes:
  - From Task 4: `fillSolidZones`, `fillGradientZones`, `sampleZones`, `clampMeterValue`, `evaluateHslMeter`, `isHslMeter`, `resolveMeterRegion`, `toPixelRect`.
  - From Task 1: `initialMeterValue`, `MockEngine`, `isRecord`.
  - From Task 6: `h`, `rafBatch`.
  - From the runtime: `hslToHex`, `ZONE_COLUMNS`, `ZONE_ROWS`.
- Produces:
  - **`screenController.ts`:**
    - `type ScreenSource = { kind: 'solid'; color } | { kind: 'gradient'; from; to } | { kind: 'capture' }`
    - `DEFAULT_SCREEN_SOURCE`
    - `interface CaptureFrame { pixels: Uint8ClampedArray<ArrayBuffer>; width; height; sourceWidth; sourceHeight }`
    - `interface FrameSource { read(); stop() }`
    - `type OpenScreenCapture = (onEnded) => Promise<FrameSource>`
    - `CAPTURE_INTERVAL_MS = 100`, `CAPTURE_SAMPLE_WIDTH = 480`
    - `interface ScreenController { source; error; frame; setSource; setMeter; manualValue; isAutomatic; subscribe }`
    - `isStoredSource(value)`
    - `createScreenController(engine, meters, storage, timers, openCapture)`
    - `openScreenCapture(onEnded, media?)`
  - **`ui/tabs/screen.ts`:** `PREVIEW_WIDTH = 280`, `PREVIEW_HEIGHT = 200`, `previewRects(meters, frame, width, height)`, `zoneColor(zone, index)`, `createScreenTab`, and `screenTab` (`id: 'screen'`).
  - **`ui/tabs/meters.ts`:** `formatMeterValue(meter, value)`, `createMetersTab`, and `metersTab` (`id: 'meters'`).
  - **`DevtoolsContext`** gains `screen`.

Behaviour:
- **Solid and gradient** fill `engine.zone` once, and are persisted under `screen`.
- **Capture** is never restored after a reload. While it runs, the frame is sampled every 100 ms into `engine.zone` and into every `linear`/`area` meter, using the meter region that the captured screen size selects. OCR meters always keep their manual values.
- **Manual values** are clamped by type and persisted under `meters`. They are written to `engine.vision` whenever the meter is not automatic.
- **Ending a capture** (switching away, or the user stopping the share) restores the manual values. A failed capture falls back to the previous source, and `error` holds the message.

DOM contract:
- **Screen tab:**
  - source buttons `[data-srgb-screen-source=solid|gradient|capture]`, with `aria-pressed`;
  - the color inputs `[data-srgb-devtools=screen-color]` for solid, and `screen-from` and `screen-to` for gradient. Only the active source's row is visible;
  - `[data-srgb-devtools=screen-error]`;
  - `canvas[data-srgb-devtools=screen-preview]`, 280×200. It shows 10×10 cells of `engine.zone`. While capturing, it shows the frame with each linear/area meter's region outlined and labelled in red.
- **Meters tab:** one `[data-srgb-meter=<name>]` row per meter. Each row has:
  - a `label` reading `<name> (<type>)`;
  - the control `[data-srgb-meter-control=<name>]`, which depends on the type:

    | Type | Control |
    |---|---|
    | `linear`, `area` | range 0–1, step 0.01 |
    | `ocr_textmatch` | select of 1/0/−1 |
    | `ocr_numeric` | number input, min −1, step 1 |

  - `[data-srgb-meter-value=<name>]`, which shows the value `engine.vision` holds, with a ` (capture)` suffix when automatic.

  Automatic controls are disabled.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/devtools/screenController.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST } from '../../test/helpers/devtools';
import { getZone } from '../runtime/zones';
import { createEngineMock } from './engine';
import {
  CAPTURE_INTERVAL_MS,
  createScreenController,
  type CaptureFrame,
  type FrameSource,
  type OpenScreenCapture,
} from './screenController';
import { createStorage } from './storage';

const PREFIX = 'srgb-effect-kit:Screen Test:';

/** A 1920×1080 screen downscaled to 192×108, entirely `rgb`. */
const solidFrame = (rgb: [number, number, number]): CaptureFrame => {
  const width = 192;
  const height = 108;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) pixels.set([...rgb, 255], i * 4);
  return { pixels, width, height, sourceWidth: 1920, sourceHeight: 1080 };
};

const setup = (openCapture: OpenScreenCapture = vi.fn()) => {
  const engine = createEngineMock(MANIFEST.meters);
  const controller = createScreenController(
    engine,
    MANIFEST.meters,
    createStorage('Screen Test', () => localStorage),
    window,
    openCapture,
  );
  return { engine, controller };
};

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('createScreenController', () => {
  it('starts with a black screen and initial meter values', () => {
    const { engine, controller } = setup();
    expect(controller.source).toEqual({ kind: 'solid', color: '#000000' });
    expect(getZone(5, 5, engine.zone)).toEqual({ h: 0, s: 0, l: 0 });
    expect({ ...engine.vision }).toEqual({ health: 0, mana: 0, victory: 0, score: -1 });
  });

  it('fills zones from solid and gradient sources and persists them', async () => {
    const { engine, controller } = setup();
    await controller.setSource({ kind: 'solid', color: '#00ff00' });
    expect(getZone(0, 0, engine.zone)).toEqual({ h: 120, s: 100, l: 50 });
    await controller.setSource({ kind: 'gradient', from: '#000000', to: '#ffffff' });
    expect(getZone(27, 0, engine.zone).l).toBe(100);
    expect(JSON.parse(localStorage.getItem(`${PREFIX}screen`)!)).toEqual({
      kind: 'gradient',
      from: '#000000',
      to: '#ffffff',
    });
  });

  it('restores the persisted source and manual meter values', () => {
    localStorage.setItem(`${PREFIX}screen`, JSON.stringify({ kind: 'solid', color: '#ff0000' }));
    localStorage.setItem(
      `${PREFIX}meters`,
      JSON.stringify({ health: 0.25, score: 7.4, mana: 'x' }),
    );
    const { engine } = setup();
    expect(getZone(0, 0, engine.zone).s).toBe(100);
    expect(engine.vision.health).toBe(0.25);
    expect(engine.vision.score).toBe(7);
    expect(engine.vision.mana).toBe(0);
  });

  it('ignores persisted captures and invalid sources', () => {
    localStorage.setItem(`${PREFIX}screen`, JSON.stringify({ kind: 'capture' }));
    expect(setup().controller.source.kind).toBe('solid');
    localStorage.setItem(`${PREFIX}screen`, JSON.stringify({ kind: 'solid', color: 'red' }));
    expect(setup().controller.source).toEqual({ kind: 'solid', color: '#000000' });
  });

  it('clamps and persists manual meter values', () => {
    const { engine, controller } = setup();
    controller.setMeter('health', 2);
    controller.setMeter('victory', -0.7);
    controller.setMeter('missing', 1);
    expect(engine.vision.health).toBe(1);
    expect(engine.vision.victory).toBe(-1);
    expect(JSON.parse(localStorage.getItem(`${PREFIX}meters`)!)).toMatchObject({
      health: 1,
      victory: -1,
    });
  });

  it('samples a capture into zones and linear/area meters, leaving OCR meters manual', async () => {
    let current = solidFrame([0, 200, 0]);
    const source: FrameSource = { read: () => current, stop: vi.fn() };
    const { engine, controller } = setup(async () => source);
    controller.setMeter('victory', 1);
    await controller.setSource({ kind: 'capture' });

    expect(controller.frame).toBe(current);
    expect(getZone(0, 0, engine.zone)).toEqual({ h: 120, s: 100, l: 39.2 });
    expect(engine.vision.health).toBe(1);
    expect(engine.vision.mana).toBe(0);
    expect(engine.vision.victory).toBe(1);
    expect(controller.isAutomatic('health')).toBe(true);
    expect(controller.isAutomatic('victory')).toBe(false);

    current = solidFrame([0, 0, 200]);
    vi.advanceTimersByTime(CAPTURE_INTERVAL_MS);
    expect(engine.vision.health).toBe(0);
    expect(engine.vision.mana).toBe(1);
  });

  it('restores manual values and stops the capture when switching away', async () => {
    const source: FrameSource = { read: () => solidFrame([0, 200, 0]), stop: vi.fn() };
    const { engine, controller } = setup(async () => source);
    controller.setMeter('health', 0.5);
    await controller.setSource({ kind: 'capture' });
    expect(engine.vision.health).toBe(1);
    await controller.setSource({ kind: 'solid', color: '#000000' });
    expect(source.stop).toHaveBeenCalledOnce();
    expect(engine.vision.health).toBe(0.5);
    expect(controller.isAutomatic('health')).toBe(false);
    expect(controller.frame).toBeUndefined();
  });

  it('falls back to the previous source when capture fails or ends', async () => {
    let ended = () => {};
    const { controller } = setup(async (onEnded) => {
      ended = onEnded;
      return { read: () => undefined, stop: vi.fn() };
    });
    await controller.setSource({ kind: 'solid', color: '#123456' });
    await controller.setSource({ kind: 'capture' });
    ended();
    await Promise.resolve();
    expect(controller.source).toEqual({ kind: 'solid', color: '#123456' });

    const failing = setup(async () => {
      throw new Error('Permission denied');
    }).controller;
    await failing.setSource({ kind: 'capture' });
    expect(failing.source.kind).toBe('solid');
    expect(failing.error).toBe('Permission denied');
  });
});
```

`packages/srgb-effect-kit/src/devtools/ui/tabs/screen.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG, MANIFEST } from '../../../../test/helpers/devtools';
import type { DevtoolsContext } from '../../context';
import { createEngineMock } from '../../engine';
import { createScreenController, type OpenScreenCapture } from '../../screenController';
import { createStorage } from '../../storage';
import { createScreenTab, previewRects, zoneColor } from './screen';

const mount = (openCapture: OpenScreenCapture = vi.fn()) => {
  const engine = createEngineMock(MANIFEST.meters);
  const storage = createStorage(MANIFEST.title, () => localStorage);
  const screen = createScreenController(engine, MANIFEST.meters, storage, window, openCapture);
  const raf = { request: vi.fn(() => 1), cancel: vi.fn() };
  const tab = createScreenTab({
    screen,
    engine,
    config: CONFIG,
    raf,
  } as unknown as DevtoolsContext);
  const find = <T extends HTMLElement>(selector: string) => tab.element.querySelector<T>(selector)!;
  return { tab, screen, engine, find };
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('Screen tab', () => {
  it('switches sources and edits their colors', async () => {
    const { screen, find } = mount();
    expect(find('[data-srgb-screen-source="solid"]').getAttribute('aria-pressed')).toBe('true');
    const color = find<HTMLInputElement>('[data-srgb-devtools="screen-color"]');
    color.value = '#ff0000';
    color.dispatchEvent(new Event('input'));
    expect(screen.source).toEqual({ kind: 'solid', color: '#ff0000' });

    find('[data-srgb-screen-source="gradient"]').click();
    await Promise.resolve();
    expect(screen.source).toEqual({ kind: 'gradient', from: '#000000', to: '#ffffff' });
    expect(
      find('[data-srgb-devtools="screen-color"]').closest('.row')!.hasAttribute('hidden'),
    ).toBe(true);
    find('[data-srgb-screen-source="solid"]').click();
    expect(screen.source).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('shows why a capture failed', async () => {
    const { find } = mount(async () => {
      throw new Error('Permission denied');
    });
    find('[data-srgb-screen-source="capture"]').click();
    await vi.waitFor(() =>
      expect(find('[data-srgb-devtools="screen-error"]').textContent).toBe('Permission denied'),
    );
    expect(find('[data-srgb-screen-source="solid"]').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('screen helpers', () => {
  it('maps meter regions onto the preview', () => {
    expect(
      previewRects(MANIFEST.meters, { sourceWidth: 1920, sourceHeight: 1080 }, 280, 200),
    ).toEqual([
      { meter: 'health', rect: { x: 28, y: 100, width: 140, height: 1 } },
      { meter: 'mana', rect: { x: 140, y: 0, width: 140, height: 100 } },
    ]);
  });

  it('converts zone cells to CSS colors', () => {
    const { zone } = createEngineMock();
    zone.hue[3] = 120;
    zone.saturation[3] = 100;
    zone.lightness[3] = 50;
    expect(zoneColor(zone, 3)).toBe('#00ff00');
    expect(zoneColor(zone, 0)).toBe('#000000');
  });
});
```

`packages/srgb-effect-kit/src/devtools/ui/tabs/meters.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG, MANIFEST } from '../../../../test/helpers/devtools';
import type { DevtoolsContext } from '../../context';
import { createEngineMock } from '../../engine';
import { createScreenController, type CaptureFrame } from '../../screenController';
import { createStorage } from '../../storage';
import { createMetersTab, formatMeterValue } from './meters';

const green: CaptureFrame = {
  pixels: new Uint8ClampedArray(Array.from({ length: 100 }, () => [0, 200, 0, 255]).flat()),
  width: 10,
  height: 10,
  sourceWidth: 1280,
  sourceHeight: 720,
};

const mount = () => {
  const engine = createEngineMock(MANIFEST.meters);
  const storage = createStorage(MANIFEST.title, () => localStorage);
  const screen = createScreenController(engine, MANIFEST.meters, storage, window, async () => ({
    read: () => green,
    stop: () => {},
  }));
  const frames: FrameRequestCallback[] = [];
  const raf = { request: (cb: FrameRequestCallback) => frames.push(cb), cancel: vi.fn() };
  const tab = createMetersTab({
    screen,
    engine,
    config: CONFIG,
    raf,
  } as unknown as DevtoolsContext);
  const control = <T extends HTMLElement = HTMLInputElement>(name: string) =>
    tab.element.querySelector<T>(`[data-srgb-meter-control="${name}"]`)!;
  const value = (name: string) =>
    tab.element.querySelector(`[data-srgb-meter-value="${name}"]`)!.textContent;
  const flush = () => frames.splice(0).forEach((frame) => frame(0));
  return { tab, screen, engine, control, value, flush };
};

beforeEach(() => localStorage.clear());

describe('Meters tab', () => {
  it('renders one row and control per meter type', () => {
    const { tab, control, value } = mount();
    expect(
      [...tab.element.querySelectorAll<HTMLElement>('[data-srgb-meter]')].map(
        (row) => row.dataset.srgbMeter,
      ),
    ).toEqual(['health', 'mana', 'victory', 'score']);
    expect(control('health')).toMatchObject({ type: 'range', min: '0', max: '1', step: '0.01' });
    expect(control<HTMLSelectElement>('victory').tagName).toBe('SELECT');
    expect(control('score')).toMatchObject({ type: 'number', value: '-1' });
    expect(value('score')).toBe('-1');
    expect(value('health')).toBe('0.00');
  });

  it('writes manual values to engine.vision', () => {
    const { engine, control, value, flush } = mount();
    const health = control('health');
    health.value = '0.4';
    health.dispatchEvent(new Event('input'));
    const victory = control<HTMLSelectElement>('victory');
    victory.value = '-1';
    victory.dispatchEvent(new Event('change'));
    expect(engine.vision.health).toBe(0.4);
    expect(engine.vision.victory).toBe(-1);
    flush();
    expect(value('health')).toBe('0.40');
  });

  it('disables linear and area controls while the capture computes them', async () => {
    const { screen, control, value, flush } = mount();
    await screen.setSource({ kind: 'capture' });
    flush();
    expect(control('health').disabled).toBe(true);
    expect(control('victory' as string).hasAttribute('disabled')).toBe(false);
    expect(value('health')).toBe('1.00 (capture)');
  });

  it('formats values per meter type', () => {
    const [health, , , score] = MANIFEST.meters;
    expect(formatMeterValue(health, 0.5)).toBe('0.50');
    expect(formatMeterValue(score, 42)).toBe('42');
  });
});
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools`
Expected: FAIL, because the modules cannot be resolved.

- [ ] **Step 2: Implement the controller and wire it into the bootstrap**

`packages/srgb-effect-kit/src/devtools/screenController.ts`:
```ts
import type { MeterDef } from '../shared';
import { initialMeterValue, type MockEngine } from './engine';
import {
  clampMeterValue,
  evaluateHslMeter,
  isHslMeter,
  resolveMeterRegion,
  toPixelRect,
} from './meters';
import { isRecord, type DevtoolsStorage } from './storage';
import { fillGradientZones, fillSolidZones, sampleZones } from './zones';

/** What `engine.zone` (and, while capturing, the linear/area meters) are computed from. */
export type ScreenSource =
  | { kind: 'solid'; color: string }
  | { kind: 'gradient'; from: string; to: string }
  | { kind: 'capture' };

export const DEFAULT_SCREEN_SOURCE: ScreenSource = { kind: 'solid', color: '#000000' };

/** One downscaled capture frame. */
export interface CaptureFrame {
  /** RGBA, row-major. */
  pixels: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
  /** The captured screen's real size, used to pick meter resolution overrides. */
  sourceWidth: number;
  sourceHeight: number;
}

/** A live screen capture. `read()` returns undefined until the first frame arrives. */
export interface FrameSource {
  read(): CaptureFrame | undefined;
  stop(): void;
}

/** Opens a screen capture; `openScreenCapture` in browsers, a fake in tests. */
export type OpenScreenCapture = (onEnded: () => void) => Promise<FrameSource>;

/** How often a capture is sampled. */
export const CAPTURE_INTERVAL_MS = 100;
/** Width captured frames are scaled down to before sampling. */
export const CAPTURE_SAMPLE_WIDTH = 480;

export interface ScreenController {
  readonly source: ScreenSource;
  /** Message of the last failed capture attempt. */
  readonly error: string | undefined;
  /** Latest frame while capturing. */
  readonly frame: CaptureFrame | undefined;
  /** Switches the source. A failed capture falls back to the previous source with `error` set. */
  setSource(source: ScreenSource): Promise<void>;
  /** Sets and persists a meter's manual value, clamped to its type's range. */
  setMeter(name: string, value: number): void;
  /** The meter's manual value (what `engine.vision` holds unless the meter is automatic). */
  manualValue(name: string): number | undefined;
  /** Whether the meter is currently computed from the capture (linear and area meters only). */
  isAutomatic(name: string): boolean;
  subscribe(listener: () => void): () => void;
}

const SOURCE_KEY = 'screen';
const METERS_KEY = 'meters';
const HEX = /^#[0-9a-f]{6}$/i;
const isHex = (value: unknown) => typeof value === 'string' && HEX.test(value);

/** Validates a persisted source; captures are never restored because they need a user gesture. */
export const isStoredSource = (value: unknown): value is ScreenSource => {
  if (!isRecord(value)) return false;
  if (value.kind === 'solid') return isHex(value.color);
  if (value.kind === 'gradient') return isHex(value.from) && isHex(value.to);
  return false;
};

type Timers = Pick<Window, 'setInterval' | 'clearInterval'>;

/**
 * Owns `engine.zone` and `engine.vision`. Solid and gradient sources fill the zones once; a capture
 * is sampled every `CAPTURE_INTERVAL_MS` into the zones and every linear/area meter. OCR meters, and
 * every meter while not capturing, use their manual values.
 */
export function createScreenController(
  engine: MockEngine,
  meters: readonly MeterDef[],
  storage: DevtoolsStorage,
  timers: Timers,
  openCapture: OpenScreenCapture,
): ScreenController {
  let source: ScreenSource = storage.read(SOURCE_KEY, isStoredSource) ?? DEFAULT_SCREEN_SOURCE;
  let error: string | undefined;
  let frame: CaptureFrame | undefined;
  let capture: FrameSource | undefined;
  let interval: number | undefined;
  let generation = 0;
  const listeners = new Set<() => void>();
  const notify = () => {
    for (const listener of listeners) listener();
  };

  const stored = storage.read(METERS_KEY, isRecord) ?? {};
  const manual = new Map<string, number>();
  for (const meter of meters) {
    const value = stored[meter.meter];
    manual.set(
      meter.meter,
      typeof value === 'number' ? clampMeterValue(meter, value) : initialMeterValue(meter),
    );
  }
  const writeManual = () => {
    for (const meter of meters) engine.vision[meter.meter] = manual.get(meter.meter)!;
  };

  const fill = (next: ScreenSource) => {
    if (next.kind === 'solid') fillSolidZones(engine.zone, next.color);
    else if (next.kind === 'gradient') fillGradientZones(engine.zone, next.from, next.to);
  };

  const sample = () => {
    const next = capture?.read();
    if (!next) return;
    frame = next;
    sampleZones(engine.zone, next.pixels, next.width, next.height);
    for (const meter of meters) {
      if (!isHslMeter(meter)) continue;
      const region = resolveMeterRegion(meter, next.sourceWidth, next.sourceHeight);
      const rect = toPixelRect(region, meter.type === 'linear', next.width, next.height);
      engine.vision[meter.meter] = evaluateHslMeter(meter, next.pixels, next.width, rect);
    }
    notify();
  };

  const stopCapture = () => {
    if (interval !== undefined) timers.clearInterval(interval);
    interval = undefined;
    capture?.stop();
    capture = undefined;
    frame = undefined;
  };

  const setSource = async (next: ScreenSource) => {
    const current = (generation += 1);
    const previous = source.kind === 'capture' ? DEFAULT_SCREEN_SOURCE : source;
    stopCapture();
    error = undefined;
    source = next;
    if (next.kind !== 'capture') {
      storage.write(SOURCE_KEY, next);
      fill(next);
      writeManual();
      notify();
      return;
    }
    notify();
    try {
      const opened = await openCapture(() => {
        if (current === generation) void setSource(previous);
      });
      if (current !== generation) {
        opened.stop();
        return;
      }
      capture = opened;
      interval = timers.setInterval(sample, CAPTURE_INTERVAL_MS);
      sample();
    } catch (reason) {
      if (current !== generation) return;
      error = reason instanceof Error ? reason.message : String(reason);
      source = previous;
      fill(previous);
      writeManual();
      notify();
    }
  };

  const isAutomatic = (name: string) => {
    const meter = meters.find((m) => m.meter === name);
    return capture !== undefined && meter !== undefined && isHslMeter(meter);
  };

  fill(source);
  writeManual();

  return {
    get source() {
      return source;
    },
    get error() {
      return error;
    },
    get frame() {
      return frame;
    },
    setSource,
    setMeter(name, value) {
      const meter = meters.find((m) => m.meter === name);
      if (!meter) return;
      manual.set(name, clampMeterValue(meter, value));
      storage.write(METERS_KEY, Object.fromEntries(manual));
      if (!isAutomatic(name)) engine.vision[name] = manual.get(name)!;
      notify();
    },
    manualValue: (name) => manual.get(name),
    isAutomatic,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * Captures a screen, window or tab with `getDisplayMedia` and returns frames scaled to
 * `CAPTURE_SAMPLE_WIDTH` pixels wide. `onEnded` runs when the user stops sharing.
 */
export async function openScreenCapture(
  onEnded: () => void,
  media: MediaDevices = navigator.mediaDevices,
): Promise<FrameSource> {
  const stream = await media.getDisplayMedia({ video: true, audio: false });
  const [track] = stream.getVideoTracks();
  const stopStream = () => {
    for (const t of stream.getTracks()) t.stop();
  };
  if (!track) {
    stopStream();
    throw new Error('No video was shared.');
  }
  track.addEventListener('ended', onEnded);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d', { willReadFrequently: true });

  return {
    read() {
      const { videoWidth, videoHeight } = video;
      if (!context || videoWidth === 0 || videoHeight === 0) return undefined;
      const width = Math.min(CAPTURE_SAMPLE_WIDTH, videoWidth);
      const height = Math.max(1, Math.round((videoHeight * width) / videoWidth));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.drawImage(video, 0, 0, width, height);
      const { data } = context.getImageData(0, 0, width, height);
      return { pixels: data, width, height, sourceWidth: videoWidth, sourceHeight: videoHeight };
    },
    stop() {
      track.removeEventListener('ended', onEnded);
      stopStream();
      video.srcObject = null;
    },
  };
}
```

In `packages/srgb-effect-kit/src/devtools/context.ts`, make these replacements:

1. Replace:

```ts
import type { RendererController } from './renderer';
```

with:

```ts
import type { RendererController } from './renderer';
import type { ScreenController } from './screenController';
```

2. Replace:

```ts
  readonly audio: AudioController;
}
```

with:

```ts
  readonly audio: AudioController;
  readonly screen: ScreenController;
}
```

In `packages/srgb-effect-kit/src/devtools/index.ts`, make these replacements:

1. Replace:

```ts
import { installRendererSimulation } from './renderer';
```

with:

```ts
import { installRendererSimulation } from './renderer';
import { createScreenController, openScreenCapture } from './screenController';
```

2. Replace:

```ts
  const audio = createAudioController(engine.audio, storage, raf, openAudioCapture);
```

with:

```ts
  const audio = createAudioController(engine.audio, storage, raf, openAudioCapture);
  const screen = createScreenController(
    engine,
    config.manifest.meters ?? [],
    storage,
    win,
    openScreenCapture,
  );
```

3. Replace:

```ts
    audio,
  };
```

with:

```ts
    audio,
    screen,
  };
```

- [ ] **Step 3: Implement and register the tabs**

`packages/srgb-effect-kit/src/devtools/ui/tabs/screen.ts`:
```ts
import { hslToHex } from '../../../runtime/color';
import { ZONE_COLUMNS, ZONE_ROWS } from '../../../runtime/zones';
import type { MeterDef } from '../../../shared';
import type { DevtoolsContext } from '../../context';
import type { MockZone } from '../../engine';
import { isHslMeter, resolveMeterRegion, toPixelRect, type PixelRect } from '../../meters';
import type { CaptureFrame, ScreenSource } from '../../screenController';
import { h, rafBatch } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

/** Preview canvas size: 10 px per zone cell. */
export const PREVIEW_WIDTH = ZONE_COLUMNS * 10;
export const PREVIEW_HEIGHT = ZONE_ROWS * 10;

/** Where each linear/area meter's region falls on a preview of `frame` scaled to `width`×`height`. */
export function previewRects(
  meters: readonly MeterDef[],
  frame: Pick<CaptureFrame, 'sourceWidth' | 'sourceHeight'>,
  width: number,
  height: number,
): { meter: string; rect: PixelRect }[] {
  return meters.filter(isHslMeter).map((meter) => ({
    meter: meter.meter,
    rect: toPixelRect(
      resolveMeterRegion(meter, frame.sourceWidth, frame.sourceHeight),
      meter.type === 'linear',
      width,
      height,
    ),
  }));
}

/** CSS color of one zone cell. */
export const zoneColor = (zone: MockZone, index: number): string =>
  hslToHex({ h: zone.hue[index]!, s: zone.saturation[index]!, l: zone.lightness[index]! });

const LABELS: Record<ScreenSource['kind'], string> = {
  solid: 'Solid color',
  gradient: 'Gradient',
  capture: 'Screen capture',
};

/**
 * The Screen tab: source buttons (`data-srgb-screen-source`), color inputs for solid and gradient,
 * the last capture error, and a preview of `engine.zone` (or, while capturing, the captured frame
 * with every linear/area meter's region outlined).
 */
export function createScreenTab({ screen, engine, config, raf }: DevtoolsContext): TabInstance {
  const meters = config.manifest.meters ?? [];
  const kinds = Object.keys(LABELS) as ScreenSource['kind'][];
  const buttons = kinds.map((kind) =>
    h('button', { type: 'button', 'data-srgb-screen-source': kind }, LABELS[kind]),
  );
  const color = h('input', { type: 'color', 'data-srgb-devtools': 'screen-color' });
  const from = h('input', { type: 'color', 'data-srgb-devtools': 'screen-from' });
  const to = h('input', { type: 'color', 'data-srgb-devtools': 'screen-to' });
  const solidRow = h('div', { class: 'row' }, h('span', {}, 'Color'), color, h('span'));
  const gradientRow = h(
    'div',
    { class: 'row' },
    h('span', {}, 'Left → right'),
    h('span', {}, from, ' ', to),
    h('span'),
  );
  const error = h('p', { class: 'error', 'data-srgb-devtools': 'screen-error', hidden: true });
  const preview = h('canvas', {
    class: 'preview',
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    'data-srgb-devtools': 'screen-preview',
  });

  // Remember the last colors so switching kinds doesn't lose them.
  let solid = '#000000';
  let gradient = { from: '#000000', to: '#ffffff' };

  buttons.forEach((button, i) => {
    button.addEventListener('click', () => {
      const kind = kinds[i]!;
      void screen.setSource(
        kind === 'solid'
          ? { kind, color: solid }
          : kind === 'gradient'
            ? { kind, ...gradient }
            : { kind },
      );
    });
  });
  color.addEventListener(
    'input',
    () => void screen.setSource({ kind: 'solid', color: color.value }),
  );
  const onGradient = () =>
    void screen.setSource({ kind: 'gradient', from: from.value, to: to.value });
  from.addEventListener('input', onGradient);
  to.addEventListener('input', onGradient);

  const draw = () => {
    const ctx = preview.getContext('2d');
    if (!ctx) return;
    const { frame } = screen;
    if (!frame) {
      for (let index = 0; index < ZONE_COLUMNS * ZONE_ROWS; index += 1) {
        ctx.fillStyle = zoneColor(engine.zone, index);
        ctx.fillRect((index % ZONE_COLUMNS) * 10, Math.floor(index / ZONE_COLUMNS) * 10, 10, 10);
      }
      return;
    }
    const image = new ImageData(frame.pixels, frame.width, frame.height);
    const scratch = document.createElement('canvas');
    scratch.width = frame.width;
    scratch.height = frame.height;
    scratch.getContext('2d')?.putImageData(image, 0, 0);
    ctx.drawImage(scratch, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    ctx.strokeStyle = '#ff1744';
    ctx.fillStyle = '#ff1744';
    ctx.font = '10px sans-serif';
    for (const { meter, rect } of previewRects(meters, frame, PREVIEW_WIDTH, PREVIEW_HEIGHT)) {
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width, rect.height);
      ctx.fillText(meter, rect.x + 2, Math.max(10, rect.y - 2));
    }
  };
  let shown = false;
  const scheduleDraw = rafBatch(raf.request, () => {
    if (shown) draw();
  });

  const render = () => {
    const { source } = screen;
    if (source.kind === 'solid') solid = source.color;
    if (source.kind === 'gradient') gradient = { from: source.from, to: source.to };
    buttons.forEach((button, i) =>
      button.setAttribute('aria-pressed', String(kinds[i] === source.kind)),
    );
    color.value = solid;
    from.value = gradient.from;
    to.value = gradient.to;
    solidRow.hidden = source.kind !== 'solid';
    gradientRow.hidden = source.kind !== 'gradient';
    error.hidden = screen.error === undefined;
    error.textContent = screen.error ?? '';
    scheduleDraw();
  };
  screen.subscribe(render);
  render();

  const element = h(
    'div',
    { 'data-srgb-devtools': 'screen' },
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Screen source' }, ...buttons),
    error,
    h('div', { class: 'rows' }, solidRow, gradientRow),
    preview,
    h(
      'p',
      { class: 'note' },
      'Writes engine.zone (28×20 cells). Screen capture also drives the linear and area meters.',
    ),
  );
  return {
    element,
    show() {
      shown = true;
      scheduleDraw();
    },
    hide() {
      shown = false;
    },
  };
}

export const screenTab: TabDefinition = { id: 'screen', label: 'Screen', create: createScreenTab };
```

`packages/srgb-effect-kit/src/devtools/ui/tabs/meters.ts`:
```ts
import type { MeterDef } from '../../../shared';
import type { DevtoolsContext } from '../../context';
import { h, rafBatch } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

/** Readout of a meter value: two decimals for linear/area, the integer otherwise. */
export const formatMeterValue = (meter: MeterDef, value: number): string =>
  meter.type === 'linear' || meter.type === 'area' ? value.toFixed(2) : String(value);

/** The input for a meter's manual value. */
function meterInput(meter: MeterDef): HTMLInputElement | HTMLSelectElement {
  const attrs = { 'data-srgb-meter-control': meter.meter };
  switch (meter.type) {
    case 'linear':
    case 'area':
      return h('input', { ...attrs, type: 'range', min: 0, max: 1, step: 0.01 });
    case 'ocr_textmatch':
      return h(
        'select',
        attrs,
        h('option', { value: '1' }, '1 (found)'),
        h('option', { value: '0' }, '0 (not found)'),
        h('option', { value: '-1' }, '-1 (unsure)'),
      );
    case 'ocr_numeric':
      return h('input', { ...attrs, type: 'number', min: -1, step: 1 });
  }
}

/**
 * The Meters tab: one row per meter (`data-srgb-meter`) with a manual value control and the value
 * `engine.vision` holds. Linear and area controls are disabled while the Screen tab's capture
 * computes them.
 */
export function createMetersTab({ screen, engine, config, raf }: DevtoolsContext): TabInstance {
  const meters = config.manifest.meters ?? [];
  const rows = meters.map((meter) => {
    const input = meterInput(meter);
    const output = h('output', { class: 'value', 'data-srgb-meter-value': meter.meter });
    input.addEventListener(input instanceof HTMLSelectElement ? 'change' : 'input', () =>
      screen.setMeter(meter.meter, Number(input.value)),
    );
    const update = () => {
      const automatic = screen.isAutomatic(meter.meter);
      input.disabled = automatic;
      if (!automatic && input.ownerDocument.activeElement !== input) {
        input.value = String(screen.manualValue(meter.meter));
      }
      const value = engine.vision[meter.meter] ?? 0;
      output.textContent = `${formatMeterValue(meter, value)}${automatic ? ' (capture)' : ''}`;
    };
    const row = h(
      'div',
      { class: 'row', 'data-srgb-meter': meter.meter },
      h('label', {}, `${meter.meter} (${meter.type})`),
      input,
      output,
    );
    return { row, update };
  });
  const updateAll = () => {
    for (const { update } of rows) update();
  };
  screen.subscribe(rafBatch(raf.request, updateAll));
  updateAll();

  const element = h(
    'div',
    { 'data-srgb-devtools': 'meters' },
    rows.length > 0
      ? h('div', { class: 'rows' }, ...rows.map(({ row }) => row))
      : h('p', { class: 'note' }, 'This effect declares no meters.'),
    h(
      'p',
      { class: 'note' },
      'Values go to engine.vision.<meter>. OCR meters are always manual; linear and area meters follow the Screen tab while it captures.',
    ),
  );
  return { element, show: updateAll };
}

export const metersTab: TabDefinition = { id: 'meters', label: 'Meters', create: createMetersTab };
```

Replace `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts` with:
```ts
import type { TabDefinition } from '../drawer';
import { audioTab } from './audio';
import { metersTab } from './meters';
import { propertiesTab } from './properties';
import { screenTab } from './screen';

/** Drawer tabs, in display order. */
export const TABS: readonly TabDefinition[] = [propertiesTab, audioTab, screenTab, metersTab];
```

- [ ] **Step 4: Run the tests and checks**

Run: `pnpm --filter srgb-effect-kit test && pnpm --filter srgb-effect-kit typecheck && pnpm lint && pnpm format`
Expected: all PASS.

Then check by hand. Add a temporary `linear` meter to `examples/basic-2d/vite.config.ts`, for example `{ meter: 'bar', type: 'linear', x: 0, y: 0.5, width: 0.5, h: [0, 360], s: [0, 100], l: [50, 100] }`, then run its dev server:
- Screen → Gradient shows a grey ramp in the preview;
- Meters → the `bar` slider changes `engine.vision.bar` in the console;
- Screen → Screen capture of any window outlines `bar`, and the meter reads `(capture)`.

Revert the example config afterwards.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/devtools
git commit -m "feat(devtools): mock engine.zone and engine.vision from colors or screen capture" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Canvas API tab, Console tab and console badge

**Files:**
- Create: `packages/srgb-effect-kit/src/devtools/ui/tabs/{canvasApi,console}.ts`
- Modify: `packages/srgb-effect-kit/src/devtools/ui/index.ts`, `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts`
- Test: `packages/srgb-effect-kit/src/devtools/ui/tabs/{canvasApi,console}.test.ts`, `packages/srgb-effect-kit/src/devtools/ui/index.test.ts`

**Interfaces:**
- Consumes:
  - From Task 2: `CanvasApiController`, `CanvasEventRecord`, `CANVAS_EVENT_PATH`.
  - From Task 5: `ConsoleCounter`, `COUNTED_METHODS`, `ConsoleCounts`.
  - From Task 6: `h`, `rafBatch`, `mountDrawer`, `DrawerHandle.setBadge`.
- Produces:
  - **`ui/tabs/canvasApi.ts`:** `curlCommand(origin, sender, event)`, `formatRecord(record)`, `createCanvasApiTab`, and `canvasApiTab` (`id: 'canvas'`, label `Canvas API`).
  - **`ui/tabs/console.ts`:** `createConsoleTab` and `consoleTab` (`id: 'console'`).
  - **`mountUi`** now keeps the toggle badge at `consoleCounter.total`, batched per native frame.

DOM contract:
- **Canvas API tab:**
  - `[data-srgb-devtools=canvas-sender]` and `canvas-event` text inputs. They are persisted under `canvas-api` and default to `devtools`/`test`;
  - `[data-srgb-devtools=canvas-send]`, which calls `canvasApi.dispatch({ sender, event }, 'drawer')`;
  - `code[data-srgb-devtools=canvas-curl]`, which holds `curl -X POST "<origin>/canvas/event?sender=…&event=…"` with the parameters URL-encoded;
  - `ul[data-srgb-devtools=canvas-log]`, which lists the newest events first, from both the drawer and HTTP.
- **Console tab:**
  - one `output[data-srgb-console=log|info|warn|error|debug|uncaught]` per count;
  - `[data-srgb-devtools=console-reset]`;
  - a note on SignalRGB's clean-console rule and `dropConsole`.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/devtools/ui/tabs/canvasApi.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../../../test/helpers/devtools';
import { createCanvasApi } from '../../canvasApi';
import type { DevtoolsContext } from '../../context';
import { createStorage } from '../../storage';
import { createCanvasApiTab, curlCommand, formatRecord } from './canvasApi';

const mount = () => {
  const canvasApi = createCanvasApi(window);
  const storage = createStorage(MANIFEST.title, () => localStorage);
  const tab = createCanvasApiTab({ canvasApi, storage, win: window } as DevtoolsContext);
  const find = <T extends HTMLElement = HTMLInputElement>(name: string) =>
    tab.element.querySelector<T>(`[data-srgb-devtools="${name}"]`)!;
  return { tab, canvasApi, find };
};

beforeEach(() => resetDevtoolsWindow());

describe('Canvas API tab', () => {
  it('sends the form to onCanvasApiEvent and lists the event', () => {
    const { find } = mount();
    const handler = vi.fn();
    window.onCanvasApiEvent = handler;
    find('canvas-sender').value = 'game';
    find('canvas-event').value = 'hit';
    find('canvas-send').click();
    expect(handler).toHaveBeenCalledWith({ sender: 'game', event: 'hit' });
    expect(find('canvas-log').textContent).toContain('drawer game/hit');
  });

  it('lists events relayed from the dev server too', () => {
    const { canvasApi, find } = mount();
    canvasApi.dispatch({ sender: 'app', event: 'boom' }, 'http');
    expect(find('canvas-log').textContent).toContain('http app/boom (no onCanvasApiEvent)');
  });

  it('shows and persists the matching curl command', () => {
    const { find } = mount();
    const sender = find('canvas-sender');
    sender.value = 'my game';
    sender.dispatchEvent(new Event('input'));
    expect(find('canvas-curl').textContent).toBe(
      'curl -X POST "http://localhost:3000/canvas/event?sender=my+game&event=test"',
    );
    expect(mount().find('canvas-sender').value).toBe('my game');
  });
});

describe('canvas API helpers', () => {
  it('builds curl commands with encoded parameters', () => {
    expect(curlCommand('http://127.0.0.1:5173', 'a&b', 'x y')).toBe(
      'curl -X POST "http://127.0.0.1:5173/canvas/event?sender=a%26b&event=x+y"',
    );
  });

  it('formats history records', () => {
    const line = formatRecord({ sender: 's', event: 'e', source: 'http', handled: true, time: 0 });
    expect(line).toMatch(/ http s\/e$/);
  });
});
```

`packages/srgb-effect-kit/src/devtools/ui/tabs/console.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installConsoleCounter, type ConsoleCounter } from '../../consoleCounter';
import type { DevtoolsContext } from '../../context';
import { createConsoleTab } from './console';

let counter: ConsoleCounter;
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  counter = installConsoleCounter(window);
});
afterEach(() => {
  counter.restore();
  vi.restoreAllMocks();
});

describe('Console tab', () => {
  it('shows counts per method, batched per frame, and resets them', () => {
    const frames: FrameRequestCallback[] = [];
    const raf = { request: (cb: FrameRequestCallback) => frames.push(cb), cancel: vi.fn() };
    const tab = createConsoleTab({ consoleCounter: counter, raf } as unknown as DevtoolsContext);
    const count = (key: string) =>
      tab.element.querySelector(`[data-srgb-console="${key}"]`)!.textContent;
    const flush = () => frames.splice(0).forEach((frame) => frame(0));

    console.warn('careful');
    window.dispatchEvent(new Event('error'));
    expect(count('warn')).toBe('0');
    flush();
    expect(count('warn')).toBe('1');
    expect(count('uncaught')).toBe('1');
    expect(count('log')).toBe('0');

    tab.element.querySelector<HTMLButtonElement>('[data-srgb-devtools="console-reset"]')!.click();
    flush();
    expect(count('warn')).toBe('0');
  });
});
```

`packages/srgb-effect-kit/src/devtools/ui/index.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../../test/helpers/devtools';
import { installConsoleCounter, type ConsoleCounter } from '../consoleCounter';
import type { DevtoolsContext } from '../context';
import { createStorage } from '../storage';
import { mountUi } from './index';

let counter: ConsoleCounter;
beforeEach(() => {
  resetDevtoolsWindow();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  counter = installConsoleCounter(window);
});
afterEach(() => {
  counter.restore();
  vi.restoreAllMocks();
});

describe('mountUi', () => {
  it('shows the console count on the toggle badge', () => {
    const frames: FrameRequestCallback[] = [];
    console.error('before mount');
    const drawer = mountUi({
      win: window,
      storage: createStorage(MANIFEST.title, () => localStorage),
      consoleCounter: counter,
      raf: { request: (cb: FrameRequestCallback) => frames.push(cb), cancel: vi.fn() },
    } as unknown as DevtoolsContext);
    const badge = drawer.root.querySelector<HTMLElement>('[data-srgb-devtools="badge"]')!;
    expect(badge.textContent).toBe('1');
    console.error('after mount');
    frames.splice(0).forEach((frame) => frame(0));
    expect(badge.textContent).toBe('2');
  });
});
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools/ui`
Expected: FAIL. The tab modules cannot be resolved, and the badge test fails with `expected '' to be '1'`.

- [ ] **Step 2: Implement the tabs and the badge**

`packages/srgb-effect-kit/src/devtools/ui/tabs/canvasApi.ts`:
```ts
import { CANVAS_EVENT_PATH } from '../../../shared';
import type { CanvasEventRecord } from '../../canvasApi';
import type { DevtoolsContext } from '../../context';
import { isRecord } from '../../storage';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

const STORAGE_KEY = 'canvas-api';

/** The `curl` command that sends the same event through the dev server. */
export const curlCommand = (origin: string, sender: string, event: string): string =>
  `curl -X POST "${origin}${CANVAS_EVENT_PATH}?${new URLSearchParams({ sender, event }).toString()}"`;

/** One history line, e.g. `12:00:01 http game/hit`, flagged when no handler was assigned. */
export const formatRecord = ({ time, source, sender, event, handled }: CanvasEventRecord): string =>
  `${new Date(time).toLocaleTimeString()} ${source} ${sender}/${event}${handled ? '' : ' (no onCanvasApiEvent)'}`;

const isForm = (value: unknown): value is { sender: string; event: string } =>
  isRecord(value) && typeof value.sender === 'string' && typeof value.event === 'string';

/**
 * The Canvas API tab: sender and event inputs (persisted), a Send button that calls
 * `window.onCanvasApiEvent({ sender, event })`, the equivalent `curl` command for the dev server,
 * and the latest events from both sources.
 */
export function createCanvasApiTab({ canvasApi, storage, win }: DevtoolsContext): TabInstance {
  const saved = storage.read(STORAGE_KEY, isForm) ?? { sender: 'devtools', event: 'test' };
  const sender = h('input', {
    type: 'text',
    value: saved.sender,
    'data-srgb-devtools': 'canvas-sender',
  });
  const event = h('input', {
    type: 'text',
    value: saved.event,
    'data-srgb-devtools': 'canvas-event',
  });
  const send = h(
    'button',
    { type: 'button', class: 'button', 'data-srgb-devtools': 'canvas-send' },
    'Send',
  );
  const curl = h('code', { 'data-srgb-devtools': 'canvas-curl' });
  const log = h('ul', { class: 'log', 'data-srgb-devtools': 'canvas-log' });

  const updateCurl = () => {
    curl.textContent = curlCommand(win.location.origin, sender.value, event.value);
    storage.write(STORAGE_KEY, { sender: sender.value, event: event.value });
  };
  sender.addEventListener('input', updateCurl);
  event.addEventListener('input', updateCurl);
  send.addEventListener('click', () =>
    canvasApi.dispatch({ sender: sender.value, event: event.value }, 'drawer'),
  );
  const renderLog = (history: readonly CanvasEventRecord[]) =>
    log.replaceChildren(...history.map((record) => h('li', {}, formatRecord(record))));
  canvasApi.subscribe(renderLog);
  renderLog(canvasApi.history);
  updateCurl();

  const element = h(
    'div',
    { 'data-srgb-devtools': 'canvas-api' },
    h(
      'div',
      { class: 'rows' },
      h('div', { class: 'row' }, h('label', {}, 'sender'), sender, h('span')),
      h('div', { class: 'row' }, h('label', {}, 'event'), event, h('span')),
    ),
    h('div', { class: 'actions' }, send),
    h('p', { class: 'note' }, 'Apps can post to the dev server like they post to SignalRGB:'),
    curl,
    log,
  );
  return { element };
}

export const canvasApiTab: TabDefinition = {
  id: 'canvas',
  label: 'Canvas API',
  create: createCanvasApiTab,
};
```

`packages/srgb-effect-kit/src/devtools/ui/tabs/console.ts`:
```ts
import { COUNTED_METHODS, type ConsoleCounts } from '../../consoleCounter';
import type { DevtoolsContext } from '../../context';
import { h, rafBatch } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

const ROWS: readonly (keyof ConsoleCounts)[] = [...COUNTED_METHODS, 'uncaught'];

/**
 * The Console tab: calls per console method and uncaught errors since load (or the last reset),
 * with a reminder that SignalRGB expects a clean console.
 */
export function createConsoleTab({ consoleCounter, raf }: DevtoolsContext): TabInstance {
  const outputs = new Map(
    ROWS.map((key) => [key, h('output', { class: 'value', 'data-srgb-console': key })]),
  );
  const render = () => {
    for (const [key, output] of outputs) output.textContent = String(consoleCounter.counts[key]);
  };
  consoleCounter.subscribe(rafBatch(raf.request, render));
  render();
  const reset = h(
    'button',
    { type: 'button', class: 'button', 'data-srgb-devtools': 'console-reset' },
    'Reset',
  );
  reset.addEventListener('click', () => consoleCounter.reset());

  const element = h(
    'div',
    { 'data-srgb-devtools': 'console' },
    h(
      'div',
      { class: 'rows' },
      ...ROWS.map((key) =>
        h(
          'div',
          { class: 'row' },
          h('span', {}, key === 'uncaught' ? 'uncaught errors' : `console.${key}`),
          h('span'),
          outputs.get(key)!,
        ),
      ),
    ),
    h('div', { class: 'actions' }, reset),
    h(
      'p',
      { class: 'note' },
      'SignalRGB expects a clean console. The build strips console calls (dropConsole), but uncaught errors still show up.',
    ),
  );
  return { element, show: render };
}

export const consoleTab: TabDefinition = {
  id: 'console',
  label: 'Console',
  create: createConsoleTab,
};
```

Replace `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts` with:
```ts
import type { TabDefinition } from '../drawer';
import { audioTab } from './audio';
import { canvasApiTab } from './canvasApi';
import { consoleTab } from './console';
import { metersTab } from './meters';
import { propertiesTab } from './properties';
import { screenTab } from './screen';

/** Drawer tabs, in display order. */
export const TABS: readonly TabDefinition[] = [
  propertiesTab,
  audioTab,
  screenTab,
  metersTab,
  canvasApiTab,
  consoleTab,
];
```

Replace `packages/srgb-effect-kit/src/devtools/ui/index.ts` with:
```ts
import type { DevtoolsContext } from '../context';
import { rafBatch } from './dom';
import { mountDrawer, type DrawerHandle } from './drawer';
import { TABS } from './tabs';

/** Mounts the drawer with every tab and keeps the toggle's badge on the console count. */
export function mountUi(context: DevtoolsContext): DrawerHandle {
  const drawer = mountDrawer(context, TABS);
  const { consoleCounter, raf } = context;
  const updateBadge = rafBatch(raf.request, () => drawer.setBadge(consoleCounter.total));
  consoleCounter.subscribe(updateBadge);
  drawer.setBadge(consoleCounter.total);
  return drawer;
}
```

- [ ] **Step 3: Run the tests and checks**

Run: `pnpm --filter srgb-effect-kit test && pnpm --filter srgb-effect-kit typecheck && pnpm lint && pnpm format`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/srgb-effect-kit/src/devtools
git commit -m "feat(devtools): add the Canvas API and Console tabs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Renderer tab and SignalRGB view tab

**Files:**
- Create: `packages/srgb-effect-kit/src/devtools/ui/tabs/{renderer,view}.ts`
- Modify: `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts`, `packages/srgb-effect-kit/src/devtools/ui/index.test.ts`
- Test: `packages/srgb-effect-kit/src/devtools/ui/tabs/{renderer,view}.test.ts`

**Interfaces:**
- Consumes:
  - From Task 5: `RendererController`, `FPS_MIN`, `FPS_MAX`.
  - From the runtime: `detectRenderer`, `Renderer`.
  - From Task 6: `VISIBLE_WIDTH`, `VISIBLE_HEIGHT`, `h`.
- Produces:
  - **`ui/tabs/renderer.ts`:** `createRateMeter(): { tick(timestamp): number | undefined }`, `createRendererTab`, and `rendererTab` (`id: 'renderer'`).
  - **`ui/tabs/view.ts`:**
    - `interface SourceRect { sx; sy; sw; sh }`
    - `findCoveringCanvas(doc)`
    - `canvasSourceRect(canvas, rect)`
    - `captureSourceRect(videoWidth, videoHeight, viewportWidth, viewportHeight)`
    - `createViewTab`, and `viewTab` (`id: 'view'`, label `SignalRGB view`)
  - **Final tab order:** properties, audio, screen, meters, canvas, renderer, view, console.

DOM contract:
- **Renderer tab:**
  - `[data-srgb-renderer=browser|ultralight|qtwebengine]` buttons, with `aria-pressed`. A click calls `setRenderer`, which reloads the page;
  - `[data-srgb-devtools=fps]`, a range from 20 to 60 that calls `setFps` live;
  - `[data-srgb-devtools=renderer-note]`;
  - `[data-srgb-devtools=raf-rate]`, the measured rate of the page's own `requestAnimationFrame` while the tab is shown;
  - `[data-srgb-devtools=detected-renderer]`, the `detectRenderer()` result;
  - `code[data-srgb-devtools=user-agent]`.
- **SignalRGB view tab:**
  - `canvas[data-srgb-devtools=view-canvas]`, 320×200 shown at 640 px wide and pixelated. It is redrawn at the FPS setting while the tab is shown;
  - `[data-srgb-devtools=view-source]`, the status line;
  - `[data-srgb-devtools=view-capture]` ("Capture this tab"), shown only when no canvas covers the visible area. It starts `getDisplayMedia({ video: true, preferCurrentTab: true })`; the capture stops when the tab is hidden.

  WebGL canvases need `preserveDrawingBuffer: true` to be sampled directly; otherwise use tab capture.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/devtools/ui/tabs/renderer.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DevtoolsContext } from '../../context';
import { installRendererSimulation, overrideUserAgent } from '../../renderer';
import { createStorage } from '../../storage';
import { createRateMeter, createRendererTab } from './renderer';

const userAgent = navigator.userAgent;
const nativeRaf = window.requestAnimationFrame;

const mount = (stored?: object) => {
  if (stored) {
    localStorage.setItem('srgb-effect-kit:Renderer Tab:renderer', JSON.stringify(stored));
  }
  const reload = vi.fn();
  const renderer = installRendererSimulation(
    window,
    createStorage('Renderer Tab', () => localStorage),
    { request: (cb) => nativeRaf(cb), cancel: vi.fn() },
    reload,
  );
  const tab = createRendererTab({ renderer, win: window } as unknown as DevtoolsContext);
  const find = <T extends HTMLElement = HTMLElement>(selector: string) =>
    tab.element.querySelector<T>(selector)!;
  return { tab, renderer, reload, find };
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  overrideUserAgent(navigator, userAgent);
  window.requestAnimationFrame = nativeRaf;
});

describe('Renderer tab', () => {
  it('shows the active renderer, FPS and detected renderer', () => {
    const { find } = mount({ renderer: 'qtwebengine', fps: 30 });
    expect(find('[data-srgb-renderer="qtwebengine"]').getAttribute('aria-pressed')).toBe('true');
    expect(find<HTMLInputElement>('[data-srgb-devtools="fps"]').value).toBe('30');
    expect(find('[data-srgb-devtools="detected-renderer"]').textContent).toBe('qtwebengine');
    expect(find('[data-srgb-devtools="user-agent"]').textContent).toContain('QtWebEngine/');
  });

  it('applies FPS changes live and reloads on renderer changes', () => {
    const { find, renderer, reload } = mount();
    const fps = find<HTMLInputElement>('[data-srgb-devtools="fps"]');
    fps.value = '24';
    fps.dispatchEvent(new Event('input'));
    expect(renderer.settings.fps).toBe(24);
    expect(reload).not.toHaveBeenCalled();
    find('[data-srgb-renderer="ultralight"]').click();
    expect(reload).toHaveBeenCalledOnce();
    expect(renderer.settings.renderer).toBe('ultralight');
  });
});

describe('createRateMeter', () => {
  it('reports the frame rate once per second', () => {
    const meter = createRateMeter();
    const reports: (number | undefined)[] = [];
    for (let i = 0; i <= 60; i += 1) reports.push(meter.tick(i * (1000 / 30)));
    expect(reports.filter((rate) => rate !== undefined)).toEqual([30, 30]);
  });
});
```

`packages/srgb-effect-kit/src/devtools/ui/tabs/view.test.ts`:
```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canvasSourceRect, captureSourceRect, findCoveringCanvas } from './view';

const box = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

beforeEach(() => document.body.replaceChildren());

describe('SignalRGB view helpers', () => {
  it('finds the first canvas covering the visible area', () => {
    const small = document.createElement('canvas');
    const full = document.createElement('canvas');
    document.body.append(small, full);
    vi.spyOn(small, 'getBoundingClientRect').mockReturnValue(box(0, 0, 100, 100));
    vi.spyOn(full, 'getBoundingClientRect').mockReturnValue(box(0, 0, 320, 200));
    expect(findCoveringCanvas(document)).toBe(full);
    vi.spyOn(full, 'getBoundingClientRect').mockReturnValue(box(8, 8, 320, 200));
    expect(findCoveringCanvas(document)).toBeUndefined();
  });

  it('maps the visible area into canvas pixels, including CSS scaling and offsets', () => {
    expect(canvasSourceRect({ width: 320, height: 200 }, box(0, 0, 320, 200))).toEqual({
      sx: 0,
      sy: 0,
      sw: 320,
      sh: 200,
    });
    // A 640×400 backing store shown at 320×200 CSS pixels, scrolled 10px left.
    expect(canvasSourceRect({ width: 640, height: 400 }, box(-10, 0, 320, 200))).toEqual({
      sx: 20,
      sy: 0,
      sw: 640,
      sh: 400,
    });
  });

  it('maps the visible area into a tab capture', () => {
    expect(captureSourceRect(2560, 1600, 1280, 800)).toEqual({ sx: 0, sy: 0, sw: 640, sh: 400 });
  });
});
```

Replace `packages/srgb-effect-kit/src/devtools/ui/index.test.ts` with this version, which adds the tab-order test:
```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../../test/helpers/devtools';
import { installConsoleCounter, type ConsoleCounter } from '../consoleCounter';
import type { DevtoolsContext } from '../context';
import { createStorage } from '../storage';
import { mountUi } from './index';

let counter: ConsoleCounter;
beforeEach(() => {
  resetDevtoolsWindow();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  counter = installConsoleCounter(window);
});
afterEach(() => {
  counter.restore();
  vi.restoreAllMocks();
});

describe('mountUi', () => {
  it('registers every tab in order', () => {
    const drawer = mountUi({
      win: window,
      storage: createStorage(MANIFEST.title, () => localStorage),
      consoleCounter: counter,
      raf: { request: vi.fn(), cancel: vi.fn() },
    } as unknown as DevtoolsContext);
    expect(
      [...drawer.root.querySelectorAll<HTMLElement>('[data-srgb-devtools-tab]')].map(
        (tab) => tab.dataset.srgbDevtoolsTab,
      ),
    ).toEqual(['properties', 'audio', 'screen', 'meters', 'canvas', 'renderer', 'view', 'console']);
  });

  it('shows the console count on the toggle badge', () => {
    const frames: FrameRequestCallback[] = [];
    console.error('before mount');
    const drawer = mountUi({
      win: window,
      storage: createStorage(MANIFEST.title, () => localStorage),
      consoleCounter: counter,
      raf: { request: (cb: FrameRequestCallback) => frames.push(cb), cancel: vi.fn() },
    } as unknown as DevtoolsContext);
    const badge = drawer.root.querySelector<HTMLElement>('[data-srgb-devtools="badge"]')!;
    expect(badge.textContent).toBe('1');
    console.error('after mount');
    frames.splice(0).forEach((frame) => frame(0));
    expect(badge.textContent).toBe('2');
  });
});
```

Run: `pnpm --filter srgb-effect-kit exec vitest run src/devtools/ui`
Expected: FAIL. The tab modules cannot be resolved, and the order test lacks `renderer` and `view`.

- [ ] **Step 2: Implement and register the tabs**

`packages/srgb-effect-kit/src/devtools/ui/tabs/renderer.ts`:
```ts
import { detectRenderer, type Renderer } from '../../../runtime/renderer';
import type { DevtoolsContext } from '../../context';
import { FPS_MAX, FPS_MIN } from '../../renderer';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

const LABELS: Record<Renderer, string> = {
  browser: 'Browser',
  ultralight: 'UltraLight',
  qtwebengine: 'QtWebEngine',
};

const NOTES: Record<Renderer, string> = {
  browser: 'No simulation: the native user agent and requestAnimationFrame.',
  ultralight:
    'UltraLight user agent; requestAnimationFrame runs at the FPS setting, as in SignalRGB.',
  qtwebengine:
    'QtWebEngine user agent; requestAnimationFrame keeps the display rate while SignalRGB samples frames at the FPS setting.',
};

/** Counts frames and reports the rate once per elapsed second. */
export function createRateMeter(): { tick(timestamp: number): number | undefined } {
  let start: number | undefined;
  let frames = 0;
  return {
    tick(timestamp) {
      if (start === undefined) {
        start = timestamp;
        frames = 0;
        return undefined;
      }
      frames += 1;
      const elapsed = timestamp - start;
      if (elapsed < 1000) return undefined;
      const rate = Math.round((frames * 1000) / elapsed);
      start = timestamp;
      frames = 0;
      return rate;
    },
  };
}

/**
 * The Renderer tab: renderer buttons (`data-srgb-renderer`; choosing one reloads the page), the
 * SignalRGB FPS setting (20–60, applied live), the reported user agent and `detectRenderer()`
 * result, and the requestAnimationFrame rate the effect actually gets, measured while shown.
 */
export function createRendererTab({ renderer, win }: DevtoolsContext): TabInstance {
  const buttons = (Object.keys(LABELS) as Renderer[]).map((id) => {
    const button = h('button', { type: 'button', 'data-srgb-renderer': id }, LABELS[id]);
    button.addEventListener('click', () => renderer.setRenderer(id));
    return button;
  });
  const fps = h('input', {
    type: 'range',
    min: FPS_MIN,
    max: FPS_MAX,
    step: 1,
    'data-srgb-devtools': 'fps',
  });
  const fpsValue = h('output', { class: 'value' });
  fps.addEventListener('input', () => renderer.setFps(Number(fps.value)));
  const note = h('p', { class: 'note', 'data-srgb-devtools': 'renderer-note' });
  const userAgent = h('code', { 'data-srgb-devtools': 'user-agent' });
  const detected = h('output', { 'data-srgb-devtools': 'detected-renderer' });
  const rate = h('output', { class: 'value', 'data-srgb-devtools': 'raf-rate' }, '–');

  const render = () => {
    const { settings } = renderer;
    for (const button of buttons) {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.srgbRenderer === settings.renderer),
      );
    }
    fps.value = String(settings.fps);
    fpsValue.textContent = `${settings.fps} FPS`;
    note.textContent = NOTES[settings.renderer];
    userAgent.textContent = win.navigator.userAgent;
    detected.textContent = detectRenderer(win.navigator.userAgent);
  };
  renderer.subscribe(render);
  render();

  // Measured with the page's (possibly throttled) rAF: what the effect's own loop gets.
  let frameId: number | undefined;
  const meter = createRateMeter();
  const measure = (timestamp: number) => {
    const hz = meter.tick(timestamp);
    if (hz !== undefined) rate.textContent = `${hz} Hz`;
    frameId = win.requestAnimationFrame(measure);
  };

  const element = h(
    'div',
    { 'data-srgb-devtools': 'renderer' },
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Renderer' }, ...buttons),
    note,
    h(
      'div',
      { class: 'rows' },
      h('div', { class: 'row' }, h('label', {}, 'SignalRGB FPS'), fps, fpsValue),
      h('div', { class: 'row' }, h('span', {}, 'requestAnimationFrame'), h('span'), rate),
      h('div', { class: 'row' }, h('span', {}, 'detectRenderer()'), detected, h('span')),
    ),
    h('p', { class: 'note' }, 'navigator.userAgent: ', userAgent),
    h(
      'p',
      { class: 'note' },
      'User agents are placeholders until verified on SignalRGB. Changing the renderer reloads the page.',
    ),
  );
  return {
    element,
    show() {
      if (frameId === undefined) frameId = win.requestAnimationFrame(measure);
    },
    hide() {
      if (frameId !== undefined) win.cancelAnimationFrame(frameId);
      frameId = undefined;
    },
  };
}

export const rendererTab: TabDefinition = {
  id: 'renderer',
  label: 'Renderer',
  create: createRendererTab,
};
```

`packages/srgb-effect-kit/src/devtools/ui/tabs/view.ts`:
```ts
import type { DevtoolsContext } from '../../context';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';
import { VISIBLE_HEIGHT, VISIBLE_WIDTH } from '../overlay';

/** A crop of a drawable source, in its own pixels. */
export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** The first page canvas whose box covers the whole visible 320×200 area, if any. */
export function findCoveringCanvas(doc: Document): HTMLCanvasElement | undefined {
  return [...doc.querySelectorAll('canvas')].find((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return (
      rect.left <= 0 &&
      rect.top <= 0 &&
      rect.right >= VISIBLE_WIDTH &&
      rect.bottom >= VISIBLE_HEIGHT
    );
  });
}

/** The visible area in a canvas's pixels, given its CSS box (canvases may be scaled by CSS). */
export function canvasSourceRect(
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): SourceRect {
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
  return {
    sx: (0 - rect.left) * scaleX,
    sy: (0 - rect.top) * scaleY,
    sw: VISIBLE_WIDTH * scaleX,
    sh: VISIBLE_HEIGHT * scaleY,
  };
}

/** The visible area in a tab capture's pixels: the video maps the viewport. */
export const captureSourceRect = (
  videoWidth: number,
  videoHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): SourceRect => ({
  sx: 0,
  sy: 0,
  sw: (VISIBLE_WIDTH * videoWidth) / viewportWidth,
  sh: (VISIBLE_HEIGHT * videoHeight) / viewportHeight,
});

/**
 * The SignalRGB view tab: a pixelated, 2× copy of the visible 320×200 area, redrawn at the FPS
 * setting while shown. It samples the covering canvas directly; without one, "Capture this tab"
 * starts an opt-in tab capture (getDisplayMedia with preferCurrentTab) that stops when the tab is
 * hidden. WebGL canvases need `preserveDrawingBuffer: true` to be sampled directly.
 */
export function createViewTab({ win, renderer, raf }: DevtoolsContext): TabInstance {
  const view = h('canvas', {
    class: 'preview',
    width: VISIBLE_WIDTH,
    height: VISIBLE_HEIGHT,
    style: `width:${VISIBLE_WIDTH * 2}px`,
    'data-srgb-devtools': 'view-canvas',
  });
  const status = h('p', { class: 'note', 'data-srgb-devtools': 'view-source' });
  const captureButton = h(
    'button',
    { type: 'button', class: 'button', 'data-srgb-devtools': 'view-capture' },
    'Capture this tab',
  );
  let video: HTMLVideoElement | undefined;
  let stream: MediaStream | undefined;
  let frameId: number | undefined;
  let last: number | undefined;

  const stopCapture = () => {
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = undefined;
    video = undefined;
  };
  captureButton.addEventListener('click', async () => {
    try {
      stream = await win.navigator.mediaDevices.getDisplayMedia({
        video: true,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);
      video = win.document.createElement('video');
      video.muted = true;
      video.srcObject = stream;
      await video.play();
    } catch (error) {
      stopCapture();
      status.textContent = `Tab capture failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  });

  const draw = () => {
    const ctx = view.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const canvas = findCoveringCanvas(win.document);
    captureButton.hidden = canvas !== undefined || video !== undefined;
    if (canvas) {
      const { sx, sy, sw, sh } = canvasSourceRect(canvas, canvas.getBoundingClientRect());
      ctx.clearRect(0, 0, VISIBLE_WIDTH, VISIBLE_HEIGHT);
      ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, VISIBLE_WIDTH, VISIBLE_HEIGHT);
      status.textContent = 'Sampling the canvas that covers the visible area.';
    } else if (video && video.videoWidth > 0) {
      const { sx, sy, sw, sh } = captureSourceRect(
        video.videoWidth,
        video.videoHeight,
        win.innerWidth,
        win.innerHeight,
      );
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, VISIBLE_WIDTH, VISIBLE_HEIGHT);
      status.textContent = 'Sampling the tab capture.';
    } else {
      status.textContent = 'No canvas covers the visible area. Capture this tab to preview it.';
    }
  };
  const loop = (timestamp: number) => {
    frameId = raf.request(loop);
    if (last !== undefined && timestamp - last < 1000 / renderer.settings.fps - 1) return;
    last = timestamp;
    draw();
  };

  const element = h(
    'div',
    { 'data-srgb-devtools': 'view' },
    view,
    status,
    h('div', { class: 'actions' }, captureButton),
  );
  return {
    element,
    show() {
      if (frameId === undefined) frameId = raf.request(loop);
    },
    hide() {
      if (frameId !== undefined) raf.cancel(frameId);
      frameId = undefined;
      last = undefined;
      stopCapture();
    },
  };
}

export const viewTab: TabDefinition = {
  id: 'view',
  label: 'SignalRGB view',
  create: createViewTab,
};
```

Replace `packages/srgb-effect-kit/src/devtools/ui/tabs/index.ts` with:
```ts
import type { TabDefinition } from '../drawer';
import { audioTab } from './audio';
import { canvasApiTab } from './canvasApi';
import { consoleTab } from './console';
import { metersTab } from './meters';
import { propertiesTab } from './properties';
import { rendererTab } from './renderer';
import { screenTab } from './screen';
import { viewTab } from './view';

/** Drawer tabs, in display order. */
export const TABS: readonly TabDefinition[] = [
  propertiesTab,
  audioTab,
  screenTab,
  metersTab,
  canvasApiTab,
  rendererTab,
  viewTab,
  consoleTab,
];
```

- [ ] **Step 3: Run everything**

Run: `pnpm lint && pnpm format && pnpm build && pnpm typecheck && pnpm test && CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e`
Expected: all PASS, with 10 e2e tests.

- [ ] **Step 4: Check the browser-only parts by hand**

Run `pnpm --filter @srgb-effect-kit-examples/basic-2d dev` and work through every tab:
- **Renderer → UltraLight:** the page reloads. `detectRenderer()` reads `ultralight`. With FPS at 30, the requestAnimationFrame rate settles at about 30 Hz and the rainbow visibly steps. QtWebEngine keeps about 60 Hz.
- **SignalRGB view:** shows the rainbow, pixelated at 2×.
- **Canvas API → Send:** the log shows `drawer devtools/test (no onCanvasApiEvent)`. The printed `curl` command adds an `http` line.
- **Console:** typing `console.log(1)` in DevTools makes the toggle badge show `1`.
- **Audio → Microphone and System audio:** both prompt, and denying either shows the error.

Reset the renderer to Browser when done.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/devtools
git commit -m "feat(devtools): add the Renderer and SignalRGB view tabs" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---


### Task 12: Documentation and spec updates

**Files:**
- Create: `docs/devtools.md`
- Modify:
  - `docs/getting-started.md`, `docs/globals.md`, `docs/configuration.md`, `docs/runtime-api.md`, `docs/signalrgb-notes.md`, `docs/build.md`
  - `README.md`, `packages/srgb-effect-kit/README.md`
  - `examples/basic-2d/README.md`, `examples/audio-visualizer/README.md`
  - `.superpowers/specs/2026-10-13-srgb-effect-kit-design.md`

**Interfaces:**
- Consumes: the behaviour built in Tasks 1–11. Each claim below matches a test or a code path. If you change wording, do not promise more than the code does.
- Produces: user documentation for the devtools. The "dev mode throws until devtools exist" caveats are removed everywhere. The spec's §10 and §11 match the implementation and record the deltas.

- [ ] **Step 1: Write `docs/devtools.md`**

````markdown
# Devtools

In `pnpm dev`, `srgbEffect()` turns the browser into a stand-in for SignalRGB. Your effect's globals exist and behave as they do in SignalRGB, and a drawer lets you drive them. The devtools are never part of `pnpm build`.

Related: [Globals](globals.md) · [Configuration](configuration.md#options) · [SignalRGB notes](signalrgb-notes.md)

## Modes

The `devtools` option picks how much of SignalRGB `pnpm dev` simulates:

| Mode | What you get in `pnpm dev` |
|---|---|
| `'full'` (default) | SignalRGB's environment plus the drawer and the visible-area marker. Everything on this page. |
| `'minimal'` | SignalRGB's environment only: handler globals, property globals at their **defaults**, a silent `engine` mock, the load-time handler calls and `POST /canvas/event`. Nothing is shown, stored or simulated beyond that, and the drawer's code is not even loaded. |
| `'none'` | Nothing. The page is served as is, so effect code that reads SignalRGB's globals throws a `ReferenceError`. |

```ts
srgbEffect({ title: 'My Effect', devtools: 'minimal' });
srgbEffect({ title: 'My Effect', devtools: { mode: 'full', fireChangedOnLoad: false } });
```

A mode string means `{ mode, fireChangedOnLoad: true }`. The rest of this page describes `'full'`; the sections on loading and on the canvas API endpoint apply to `'minimal'` too.

## What happens when the page loads

The plugin adds a module script at the start of `<head>`. Module scripts run in document order, so it runs before your code and, synchronously, does the following (in `'minimal'`, only steps 1, 3 and 4, with defaults instead of stored values):

1. Creates every `on<Prop>Changed` global and `onCanvasApiEvent`, set to `undefined`, like the build's prelude. A bare `onSpeedChanged = …` therefore works in dev too.
2. Applies the [renderer simulation](#renderer) you last chose.
3. Sets every property global in SignalRGB's raw format, using the value you last chose or the default:

   | Type | Raw value |
   |---|---|
   | `number`, `hue` | number |
   | `boolean` | `'0'` or `'1'` |
   | `color` | `#rrggbb` |
   | `textfield`, `list` | string |

4. Installs a mock `engine`:
   - `engine.audio` is silent;
   - `engine.zone` is black;
   - `engine.vision.<meter>` is 0 for every meter, and -1 for `ocr_numeric`.

Your code then runs. On `DOMContentLoaded`, after every module script has run, the devtools call each `on<Prop>Changed` once, in property order, like SignalRGB does at load. Then they mount the drawer.

The exact order and timing of SignalRGB's load-time calls is not verified yet. To turn the load-time calls off:

```ts
srgbEffect({ title: 'My Effect', devtools: { fireChangedOnLoad: false } });
```

## The visible area

SignalRGB shows only the top-left 320×200 of the page. A red line along x = 320 and another along y = 200 mark its edges, drawn just outside it so they cover none of your pixels. In the drawer's header:
- **Area** toggles the lines.
- **Dim** darkens everything outside the area.

## The drawer

The **SRGB** button in the bottom-right corner opens the drawer:
- **Dock right** and **Dock bottom** move it.
- Dragging its inner edge resizes it.
- The open state, dock side, size, selected tab and area toggles survive reloads.

The drawer lives in its own Shadow DOM on `<html>`, outside `<body>`. Your CSS cannot reach it, and it does not change your layout or catch clicks outside its own controls. A badge on the SRGB button counts console output; see [Console](#console).

## Tabs

### Properties

There is one control per property, in the order you declared them:

| Type | Control |
|---|---|
| `number` | slider with its value |
| `hue` | slider on a hue gradient |
| `boolean` | checkbox |
| `color` | color picker |
| `textfield` | text input, updated on every keystroke |
| `list` | dropdown |

A change sets the global, then calls `window.on<Property>Changed()` with no arguments, as SignalRGB does. Setting the value the global already has calls nothing. **Reset to defaults** restores every default and calls the handlers of the properties that changed.

Values persist across reloads. A stored value that no longer fits the config falls back to the default; examples are a list value you removed, or a renamed property. Numbers outside a changed `min`/`max` are clamped instead.

### Audio

Writes `engine.audio` on every frame:

| Mode | Behaviour |
|---|---|
| Silent | `level` -100 and everything else 0. [`isSilent()`](runtime-api.md#issilent) is `true`. |
| Random | Noisy but plausible values: `level` from -60 to 0 dB, and 200 bands from 0 to 255 that fall off towards the high end. |
| Microphone | Analyses your microphone. |
| System audio | Analyses a tab or screen you share. Tick **Share audio** in the browser's picker. |

From live audio:
- `level` is the loudness in dB;
- `width` is the stereo width (0 for mono);
- `density` is the spectral flatness (near 0 for a pure tone, near 1 for noise);
- `freq` holds the first 200 bands of a 512-point FFT, each 0–255.

If the browser denies access, or no audio was shared, the mode falls back to Silent with the reason shown. Stopping the share also returns to Silent. Only Silent and Random are restored after a reload, because the other two need a click.

### Screen

Writes `engine.zone`, the 28×20 grid:

| Source | Behaviour |
|---|---|
| Solid color | Fills the grid with one color. |
| Gradient | Fills the grid with a left-to-right gradient. |
| Screen capture | Shares a screen, window or tab. The capture is sampled 10 times a second and averaged per cell. |

The preview shows the grid. During a capture, it shows the captured frame with each `linear` and `area` meter's region outlined. Zone values use hue 0–360 and saturation and lightness 0–100. That scale is not verified on SignalRGB yet.

### Meters

There is one control per meter, and its value goes to `engine.vision.<meter>`:
- `linear` and `area`: a 0–1 slider.
- `ocr_textmatch`: 1, 0 or -1.
- `ocr_numeric`: a whole number, -1 for "nothing read".

While the Screen tab captures, `linear` and `area` meters are computed from the capture instead: the fraction of pixels in the meter's region whose color falls inside its `h`, `s` and `l` ranges. The region comes from the [resolution override](configuration.md#resolutions) that matches the captured screen's size, or its aspect ratio within 3%. `hdr-*` ranges are not simulated. OCR meters are always manual.

### Canvas API

The **Send** button calls `window.onCanvasApiEvent({ sender, event })` with the sender and event you type.

The dev server also mirrors SignalRGB's endpoint, so apps and scripts can target your effect during development:

```sh
curl -X POST "http://localhost:5173/canvas/event?sender=my-app&event=hit"
```

- **Path:** the endpoint is at `/canvas/event`, whatever your Vite `base` is.
- **Responses:** it answers `204`, and `405` for methods other than POST. Missing parameters arrive as empty strings.
- **Delivery:** the event reaches every open tab of the effect through Vite's WebSocket.
- **Ports:** SignalRGB listens on port 16034. To reuse an integration unchanged, point it at the dev server's port instead, or run the dev server on 16034 while SignalRGB is closed (`server.port`).

The tab lists the latest events from both sources, and flags those that arrived while no `onCanvasApiEvent` was assigned.

### Renderer

Simulates the renderer SignalRGB uses, together with its FPS setting (20–60):

| Renderer | User agent | requestAnimationFrame |
|---|---|---|
| Browser | yours | native |
| UltraLight | an UltraLight user agent | throttled to the FPS setting |
| QtWebEngine | a QtWebEngine user agent | native (SignalRGB samples frames at the FPS setting) |

[`detectRenderer()`](runtime-api.md#detectrenderer) and `isSignalRGB()` follow the simulation without any code change. Changing the renderer reloads the page, so your code starts under it. The FPS setting applies at once. The tab measures the requestAnimationFrame rate your loop actually gets.

The simulated user agents are placeholders until they are verified on SignalRGB. The simulation covers the user agent and frame timing only; it does not reproduce each renderer's web feature support.

### SignalRGB view

A live, pixelated 2× copy of the visible 320×200, redrawn at the FPS setting:
- If a canvas covers the area, it is sampled directly. A WebGL canvas must be created with `preserveDrawingBuffer: true` for this to work.
- Otherwise, **Capture this tab** shares the current tab and crops it.

### Console

SignalRGB expects a clean console. This tab counts `console.log`, `info`, `warn`, `error` and `debug` calls, plus uncaught errors and unhandled promise rejections, since the page loaded. Vite's own messages are not counted. The same total appears as a badge on the SRGB button.

The build removes `console.*` calls by default ([`dropConsole`](build.md#dropconsole-and-minification)), but uncaught errors still reach SignalRGB's console.

## Stored settings

Settings live in `localStorage` under `srgb-effect-kit:<title>:<key>`. Every effect served from `localhost:5173` shares one origin, so the key includes the effect's title, which keeps effects apart. Changing the title starts from defaults.

The keys are:

| Key | Holds |
|---|---|
| `properties` | property values |
| `drawer` | drawer state |
| `audio` | audio mode |
| `screen` | screen source |
| `meters` | manual meter values |
| `renderer` | renderer and FPS |
| `canvas-api` | the last sender and event |

**Reset to defaults** in the Properties tab restores the properties. To clear every setting, clear the site's data in the browser.

## Limits

- **Classic scripts:** an inline classic `<script>` in `index.html` runs while the page parses, before any module script, so it does not see the globals. Keep effect code in module scripts, as Vite does by default.
- **Load-time calls:** these run on `DOMContentLoaded`. Handlers assigned later, for example after a top-level `await`, miss them.
- **Capture:** screen, tab and audio capture need a click and the browser's permission each time.
````

- [ ] **Step 2: Remove the "not built yet" caveats and link the new page**

Apply each replacement below exactly. Each `old` text occurs once in its file.

1. In `docs/getting-started.md`, replace:

````markdown
The effect itself does not run in the browser yet. SignalRGB injects the property globals, and the dev server does not define them until the devtools drawer is built. For now the browser console shows `ReferenceError: speed is not defined` on every frame. Use the dev server to check the generated markup and catch config errors, and test the effect's behaviour in SignalRGB.
````

with:

````markdown
The effect runs in the page: the plugin's [devtools](devtools.md) define `speed`, `mode` and SignalRGB's other globals before your code runs, and call `onModeChanged` once at load, like SignalRGB. Click **SRGB** in the bottom-right corner to open the drawer. Move the Speed slider, or pick another Mode, and the rainbow follows. The red lines mark the 320×200 area SignalRGB shows.
````

2. In `docs/globals.md`, replace:

````markdown
A bare assignment, `onTintChanged = () => { … }`, also type-checks and works in the built effect. The build adds a small prelude script that creates every handler global before your code runs, so the assignment does not throw in strict mode. The dev server has no prelude, so prefer `window.`.
````

with:

````markdown
A bare assignment, `onTintChanged = () => { … }`, also type-checks and works. The build adds a small prelude script that creates every handler global before your code runs, so the assignment does not throw in strict mode. In `pnpm dev` the [devtools](devtools.md) create them the same way.
````

3. In `docs/globals.md`, replace:

````markdown
`engine` exists only inside SignalRGB. In code that must also run in a plain browser, guard it with `globalThis.engine?.…`:
````

with:

````markdown
SignalRGB injects `engine`, and in `pnpm dev` the [devtools](devtools.md) provide a mock. A built effect opened in a plain browser has no `engine`, so in code that must also run there, guard it with `globalThis.engine?.…`:
````

4. In `docs/globals.md`, replace:

````markdown
## Globals in `vite dev`

The devtools drawer that will simulate SignalRGB in the browser is not built yet. Until it is, the dev server defines none of these globals:

- Reading a property global, such as `let current = speed` at the top of a module, throws `ReferenceError: speed is not defined`.
- A bare handler assignment, `onSpeedChanged = …`, throws a `ReferenceError`, because there is no prelude in dev. `window.onSpeedChanged = …` works.
- `engine` is undefined. The runtime helpers treat that as silence and black screen zones.

These all work inside SignalRGB. Test behaviour there, and use the dev server to check the generated markup and catch config and type errors.
````

with:

````markdown
## Globals in `vite dev`

In `pnpm dev`, the [devtools](devtools.md) define every global on this page before your code runs:
- Property globals hold SignalRGB's raw format, starting from your defaults.
- Every handler global exists, so a bare assignment works.
- `engine` is a mock.

On `DOMContentLoaded`, the devtools call each `on<Prop>Changed` once, like SignalRGB does at load. With the default `devtools: 'full'`, the drawer's controls change the globals and call the handlers on every change. `devtools: 'minimal'` keeps the globals at their defaults, with nothing on screen.

With `devtools: 'none'` none of this happens:
- reading a property global throws `ReferenceError`;
- a bare handler assignment throws too;
- `engine` is undefined.
````

5. In `docs/configuration.md`, replace:

````markdown
`srgbEffect()` validates `options` (see [Validation](#validation)) and returns three Vite plugins. Put the returned array in Vite's `plugins` array as is; Vite flattens it.
````

with:

````markdown
`srgbEffect()` validates `options` (see [Validation](#validation)) and returns the Vite plugins below; `srgb-effect:devtools` is left out when `devtools` is `'none'`. Put the returned array in Vite's `plugins` array as is; Vite flattens it.
````

6. In `docs/configuration.md`, replace:

````markdown
- `srgb-effect:module-scope-check` warns about [module-scoped change handlers](globals.md#do-not-declare-handlers-at-module-scope).
````

with:

````markdown
- `srgb-effect:module-scope-check` warns about [module-scoped change handlers](globals.md#do-not-declare-handlers-at-module-scope).
- `srgb-effect:devtools` runs only in `pnpm dev`. It defines SignalRGB's globals before your code, serves `POST /canvas/event` and, in the default `'full'` mode, adds the [devtools drawer](devtools.md).
````

7. In `docs/configuration.md`, replace:

````markdown
| `devtools`    | `boolean \| { fireChangedOnLoad?: boolean }` | `true`                      | Dev-only devtools drawer. Not built yet; see below.                                                       |
````

with:

````markdown
| `devtools`    | `'none' \| 'minimal' \| 'full' \| { mode?, fireChangedOnLoad? }` | `'full'` | SignalRGB simulation in `pnpm dev`. See below and [Devtools](devtools.md#modes). |
````

8. In `docs/configuration.md`, replace:

````markdown
The devtools drawer is planned but not built yet. It will simulate property controls, audio, screen zones, meters, canvas API events, renderers and frame rates, and mark the visible 320×200 area. `devtools` already accepts `true`, `false` or `{ fireChangedOnLoad }`. `fireChangedOnLoad` defaults to `true`; it will make the drawer call every `on<Prop>Changed` once at load, like SignalRGB does. Today the option has no effect.
````

with:

````markdown
`devtools` picks one of three [modes](devtools.md#modes) for `pnpm dev`. None of them is ever part of the build.

| Mode | Behaviour |
|---|---|
| `'full'` (default) | Defines SignalRGB's globals before your code runs, and adds a drawer that simulates property controls, audio, screen zones and meters, canvas API events, and renderers and frame rates. It also marks the visible 320×200 area. |
| `'minimal'` | Defines the same globals (properties at their defaults), the `engine` mock and `POST /canvas/event`, with nothing visible. |
| `'none'` | Injects nothing. |

A string is shorthand for `{ mode }`. `fireChangedOnLoad` (default `true`) calls every `on<Prop>Changed` once at load, like SignalRGB does, in both `'minimal'` and `'full'`. The boolean form of earlier versions (`true`/`false`) is rejected with an error that lists these forms.
````

9. In `docs/runtime-api.md`, replace:

````markdown
Identifies the renderer from a user agent string, by default `navigator.userAgent` (or `''` when there is no `navigator`). Returns `'ultralight'` or `'qtwebengine'` when a [signature](#renderer_signatures) matches, otherwise `'browser'`, as in `vite dev`.
````

with:

````markdown
Identifies the renderer from a user agent string, by default `navigator.userAgent` (or `''` when there is no `navigator`). Returns `'ultralight'` or `'qtwebengine'` when a [signature](#renderer_signatures) matches, otherwise `'browser'`. In `vite dev` that is `'browser'` unless the [devtools' Renderer tab](devtools.md#renderer) simulates a renderer.
````

10. In `docs/runtime-api.md`, replace:

````markdown
detectRenderer(); // 'browser' in vite dev
````

with:

````markdown
detectRenderer(); // 'browser' in vite dev, unless the devtools simulate a renderer
````

11. In `docs/signalrgb-notes.md`, replace:

````markdown
So never assume a fixed frame rate.
````

with:

````markdown
The [devtools' Renderer tab](devtools.md#renderer) simulates both behaviours in `pnpm dev`. So never assume a fixed frame rate.
````

12. In `docs/build.md`, replace:

````markdown
- **No `public/` copy.**
````

with:

````markdown
- **No devtools.** The [devtools](devtools.md) exist only in `pnpm dev`; nothing of them reaches the build.
- **No `public/` copy.**
````

13. In `README.md`, replace:

````markdown
 Run `pnpm dev` once so your editor has the types too. The effect itself only runs inside SignalRGB for now, because the dev server does not define the property globals yet ([why](docs/globals.md#globals-in-vite-dev)). Then build:
````

with:

````markdown
 `pnpm dev` also generates the types for your editor. It runs the effect in the browser, with [devtools](docs/devtools.md) that simulate SignalRGB's globals, controls, audio, screen, meters and canvas API events. Then build:
````

14. In `README.md`, replace:

````markdown
- [Build](docs/build.md): what `vite build` produces, the `script` modes (module by default), and every build error and warning.
````

with:

````markdown
- [Devtools](docs/devtools.md): how `pnpm dev` simulates SignalRGB, and each tab of the drawer.
- [Build](docs/build.md): what `vite build` produces, the `script` modes (module by default), and every build error and warning.
````

15. In `README.md`, replace:

````markdown
CI runs the build before the typecheck, so the examples generate their git-ignored `src/srgb-effect.d.ts` before it is checked. `pnpm format:fix` applies Prettier.
````

with:

````markdown
CI runs the build before the typecheck, so the examples generate their git-ignored `src/srgb-effect.d.ts` before it is checked. `pnpm format:fix` applies Prettier.

The devtools also have end-to-end tests. They drive `examples/basic-2d` in Chromium against the built package:

```sh
pnpm build
pnpm exec playwright install chromium   # once; or set CHROMIUM_PATH to a local Chromium
pnpm test:e2e
```
````

16. In `README.md`, replace:

````markdown
Status: the core plugin and runtime are built. The in-browser devtools drawer (Plan 2) and the probe effect that verifies behaviour on real SignalRGB (Plan 3) are not built yet.
````

with:

````markdown
Status: the plugin, the runtime and the devtools are built. The probe effect that verifies behaviour on real SignalRGB (Plan 3) is not built yet, so the simulated user agents, raw formats and load-time call order are provisional.
````

17. In `packages/srgb-effect-kit/README.md`, replace:

````markdown
- The dev server does not define SignalRGB's globals yet; a dev-only devtools drawer that simulates them is planned. Until then, reading a property global or making a bare `onSpeedChanged = …` assignment throws a `ReferenceError` in the browser. Both work inside SignalRGB.
````

with:

````markdown
- `pnpm dev` runs your effect in the browser: the devtools define SignalRGB's globals before your code and add a drawer for the property controls, audio, screen zones, meters, canvas API events and renderer/FPS simulation. They are never part of the build.
````

18. In `packages/srgb-effect-kit/README.md`, replace:

````markdown
- [Build](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/build.md):
````

with:

````markdown
- [Devtools](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/devtools.md): how `pnpm dev` simulates SignalRGB.
- [Build](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/build.md):
````

19. In `examples/basic-2d/README.md`, replace:

````markdown
- `pnpm dev`: develop in the browser. Until the devtools land, dev mode does not define the property globals, so this effect's top-level `baseHue` read throws a `ReferenceError` there. It works inside SignalRGB.
````

with:

````markdown
- `pnpm dev`: develop in the browser. Open the SRGB drawer to change the controls.
````

20. In `examples/audio-visualizer/README.md`, replace:

````markdown
- `pnpm dev`: develop in the browser. Audio mocks arrive with devtools (Plan 2); until then the bars stay empty.
````

with:

````markdown
- `pnpm dev`: develop in the browser. In the SRGB drawer, Audio → Random or System audio drives the bars.
````

21. In `docs/configuration.md`, replace:

````markdown
- `DevtoolsOptions`: the object form of the `devtools` option, `{ fireChangedOnLoad?: boolean }`.
````

with:

````markdown
- `DevtoolsMode`: `'none' | 'minimal' | 'full'`, the string form of the `devtools` option.
- `DevtoolsOptions`: the object form of the `devtools` option, `{ mode?: DevtoolsMode; fireChangedOnLoad?: boolean }`.
````

Then run: `grep -rn -i "not built yet\|until the devtools\|devtools land\|Plan 2\|no prelude" docs README.md packages/srgb-effect-kit/README.md examples/*/README.md`
Expected: no output.

- [ ] **Step 3: Update the spec**

In `.superpowers/specs/2026-10-13-srgb-effect-kit-design.md`, replace the whole `## 10. Devtools (serve mode only)` section, up to but not including `## 11. Testing`, with:

````markdown
## 10. Devtools (serve mode only)

Refined by Plan 2 (`.superpowers/plans/2026-10-15-srgb-effect-kit-devtools.md`). §10.6 lists what changed from the first version of this section.

### 10.1 Modes, injection and bootstrap

- **Modes.** `devtools` is `'none' | 'minimal' | 'full'`, or `{ mode?, fireChangedOnLoad? }`. The default is `'full'`, and a string means `{ mode, fireChangedOnLoad: true }`. Each mode does the following in serve mode:
  - `'none'` injects nothing: no prelude, globals, engine, relay or drawer.
  - `'minimal'` fully simulates the SignalRGB environment, with nothing visible:
    - the handler prelude;
    - every property global at its manifest **default** (no localStorage, since nothing can change values);
    - the `engine` mock;
    - the load-time calls per `fireChangedOnLoad`;
    - the `POST /canvas/event` relay.

    It has no drawer, no marker, no renderer simulation (the renderer stays `browser`) and no console counter.
  - `'full'` is `'minimal'` plus everything in §10.2–§10.4, with values persisted.
- **The plugin.** In serve mode, the `srgb-effect:devtools` plugin (`apply: 'serve'`, omitted for `'none'`) does three things:
  - Injects `<script type="module" src="/@id/__x00__virtual:srgb-effect/devtools">` with `injectTo: 'head-prepend'` (`transformIndexHtml`, `order: 'pre'`). Vite prefixes `base`. Module scripts execute in document order, so the bootstrap runs before the effect's scripts. The core plugin still injects the §5.3 head markup, for parity with the build.
  - Serves the virtual module. It imports the devtools bundle by absolute path and calls `startDevtools(config, { hot: import.meta.hot })`. The config is `{ manifest, fireChangedOnLoad }`, inlined as JSON.
  - Serves `POST /canvas/event`, described in §10.4.
- **The bundles.** There are two internal tsdown entries, built by separate configs so each is self-contained: `dist/devtools/index.js` (full) and `dist/devtools/minimal.js`. Both target the browser platform and neither is exported. `minimal.js` contains no drawer, tab, renderer or console-counter code. The plugin resolves the mode's bundle relative to its own module:
  - `dist/vite/index.js` → `dist/devtools/{index,minimal}.js` when running from the package;
  - `src/vite/` → `src/devtools/{index,minimal}.ts` when running from source in tests.

  Vite serves it through `/@fs/`. Resolved import ids are treated as safe, so this works from `node_modules`, workspaces and `file:` installs.
- **The bootstrap.** The full entry, synchronously, at module top level, does the following. The minimal entry does steps 1, 4 and 5 (with defaults) and 7, through the same `startSimulation()`.
  1. Defines every `on<Prop>Changed` and `onCanvasApiEvent` global that does not exist (the prelude guarantee, from `handlerGlobalNames`).
  2. Applies the persisted renderer simulation: the user agent and, for UltraLight, the rAF throttle.
  3. Wraps the console for the Console tab.
  4. Sets every property global from localStorage or the default, in raw format. Invalid stored values fall back to the default; numbers are clamped and rounded.
  5. Installs the `engine` mock:
     - `audio`: silent;
     - `zone`: 560-cell arrays;
     - `vision`: every meter at 0, and −1 for `ocr_numeric`.
  6. Restores the audio mode and the screen source (solid or gradient only).
  7. Subscribes to the canvas-event relay.

  On `DOMContentLoaded`, it fires every `on<Prop>Changed` in property order if `fireChangedOnLoad` is set (the default), then mounts the drawer. `DOMContentLoaded` fires after all module scripts have executed; a microtask would fire before user code.
- **Handler calls.** Handlers are called with no arguments and `this === window`. Errors go to `reportError`, and the remaining handlers still run.
- **Storage** (full mode only). localStorage keys are `srgb-effect-kit:<title>:<key>`, because all projects share the `localhost:5173` origin. The keys are `properties`, `drawer`, `audio`, `screen`, `meters`, `renderer` and `canvas-api`. Every read is validated.
- **Build output.** The devtools are never present in it. Both an integration test and an e2e test assert this.

### 10.2 Page rendering

- **No iframe.** The effect page renders as-is, at full size.
- **The shadow host.** `<srgb-effect-devtools>`, appended to `<html>` so that effect code rewriting `<body>` keeps it. It is `position: fixed; inset: 0; pointer-events: none`, with an open shadow root.
- **The visible-area marker.** A red line at x = 320 (201 px high) and one at y = 200 (321 px wide), just outside the visible pixels. Optional dimming covers the region outside 320×200. Both are toggleable and persisted.

### 10.3 Drawer UI

The drawer follows the style of TanStack Query/Router devtools.

- **Isolation.** It lives in the shadow root. It is isolated from the effect's CSS and does not affect the effect's layout.
- **Collapsed state.** It is collapsed by default to a toggle button in the bottom-right corner. The button carries a badge with the console count.
- **Open state.** When open, it docks bottom or right and is resizable from its inner edge, between 160 px and 90% of the viewport. Open state, dock side, size, selected tab and marker toggles are persisted.
- **Tabs.** Each tab is created the first time it is selected. Tabs that do periodic work run it only while visible.
- **Implementation.** Vanilla TypeScript, with the CSS as a TS string. There is no UI framework and no runtime dependency.

### 10.4 Tabs

| Tab | Behaviour |
|---|---|
| Properties | One control per type, in manifest order: number → slider plus value; hue → slider with a hue-gradient track for its min–max; boolean → checkbox; color → color input; textfield → text input, firing per keystroke; list → `<select>`. A change sets the global in raw format, persists it, then calls `window.on<Prop>Changed?.()`. Unchanged values do not fire. "Reset to defaults" fires only for values that change. |
| Audio | Modes: silent, random, microphone (`getUserMedia`) and system (`getDisplayMedia` audio). Every native animation frame writes `engine.audio.{level, width, density, freq[200]}` in place. Live audio gives `level` = RMS dB of the mix, `width` = side/(mid+side) RMS, `density` = spectral flatness, and `freq` = 200 byte bands of a 512-point FFT. A failed capture, or the end of sharing, returns to silent with a message. Only silent and random are restored after a reload. |
| Screen | Sources: solid color, left-to-right gradient, and screen capture (`getDisplayMedia` video). A capture is sampled every 100 ms at 480 px wide and averaged into the 28×20 grid, which writes the `engine.zone` arrays (hue 0–360, s/l 0–100, provisional). The preview shows the grid or, while capturing, the frame with meter regions outlined. |
| Meters | A manual value control per meter: `linear`/`area` 0–1, `ocr_textmatch` −1/0/1, `ocr_numeric` an integer ≥ −1. Values are clamped and persisted, and written to `engine.vision.<name>`. While a screen capture is active, `linear` and `area` values are computed from the captured pixels. The region is the base region, or the resolution override that matches the capture's size exactly or its aspect within 3%. The value is the fraction of pixels inside the meter's h/s/l ranges. `hdr` ranges are not simulated, and OCR meters stay manual. |
| Canvas API | A sender/event form (persisted) that calls `window.onCanvasApiEvent?.({ sender, event })`, the equivalent `curl` command, and a history of the last 20 events from both sources. The dev server serves `POST /canvas/event?sender=…&event=…` at that path whatever the `base`. Missing parameters become `''`. It answers 204 with `Access-Control-Allow-Origin: *`, and 405 for other methods; Vite's CORS middleware answers preflights. Requests are relayed over Vite's WebSocket (`server.ws.send('srgb-effect:canvas-event', …)` → `import.meta.hot.on`). |
| Renderer | Simulates `browser` / `ultralight` / `qtwebengine` together with an SRGB FPS setting (20–60). The simulation overrides `navigator.userAgent` with placeholder UA strings until the probe runs; these are the runtime's renderer test fixtures, so `detectRenderer()` needs no dev hook. UltraLight simulation replaces `requestAnimationFrame`/`cancelAnimationFrame` with a throttle at the FPS setting; QtWebEngine leaves rAF at the native rate. Changing the renderer reloads the page, while the FPS applies live. The tab shows the measured rAF rate. |
| SignalRGB view | A scaled-up (2×), pixelated live copy of the visible 320×200, sampled at the FPS setting. If a canvas covers the region, it is sampled directly; WebGL needs `preserveDrawingBuffer: true`. Otherwise, opt-in tab capture (`getDisplayMedia` with `preferCurrentTab`) is cropped to the region and stops when the tab is hidden. |
| Console | Counts `console.log`/`info`/`warn`/`error`/`debug` calls and uncaught errors/unhandled rejections, ignoring Vite's `[vite]` messages. The total shows as the toggle badge (the clean-console requirement). |

### 10.5 Testing the devtools

See §11.

### 10.6 Changes from the first version of §10 (Plan 2, 2026-10-15)

- **Devtools modes (decided 2026-10-15).** The boolean `devtools` option is replaced by `'none' | 'minimal' | 'full' | { mode, fireChangedOnLoad }`, with a default of `'full'`. `true`/`false` are rejected, because the package is pre-release.
  - `'minimal'` is the SignalRGB environment with nothing visible and no persistence, served from its own small bundle.
  - `ResolvedOptions.devtools` is `{ mode, fireChangedOnLoad }`.
- **Manifest delivery.** There is no separate `virtual:srgb-effect/manifest` module. The single virtual module `virtual:srgb-effect/devtools` inlines the config and imports the bundle, and the bundle has no Vite dependency: `import.meta.hot` is passed in.
- **Host placement.** The drawer host is appended to `<html>`, not `<body>`.
- **Mount timing.** The drawer mounts on `DOMContentLoaded`, after the load-time handler calls.
- **Console tab scope.** It also counts `info`, `debug`, uncaught errors and unhandled rejections; the first version counted log/warn/error only.
- **Renderer changes reload the page.** That way, effect code that reads the user agent at the top level sees the simulated one.
- **Restored capture modes.** Capture modes (audio and screen) are not restored after a reload, because they need a user gesture.
- **Endpoint details.** The status codes, CORS, the base-independent path and empty-string defaults are now specified.
- **Specified simulation math.** The audio math, the zone scale, the capture sampling rate, the meter evaluation (no `hdr`, aspect within 3%) and the initial meter values are now specified.
````

In §11, replace these two bullets:

```markdown
- **`devtools/`:** jsdom tests covering bootstrap ordering, global setting, raw-format conversion, persistence namespacing and the canvas-event relay. The UI is verified manually through the examples.
- **CI:** build all examples as an end-to-end smoke test.
```

with:

````markdown
- **`devtools/`:**
  - jsdom unit tests (vitest) cover the logic:
    - bootstrap ordering and the load-time calls;
    - raw-format conversion and persistence, including stale and corrupt stored values;
    - storage namespacing and blocked storage;
    - handler error isolation;
    - the canvas-event relay;
    - audio, zone and meter math;
    - the rAF throttle and user-agent override;
    - the console counter;
    - the audio and screen controllers, with fake capture sources.
  - jsdom tests also cover each drawer tab's DOM contract.
  - Option resolution has unit tests: each mode, the string shorthand, and the rejection of booleans and unknown modes.
  - The plugin side has integration tests: the injected tag and its base handling, the virtual module per mode (`minimal` imports `minimal.ts`, `full` imports `index.ts`), the endpoint (204/405, encoding, base) and `'none'` (no tag, no module, 404). They also assert that the build contains no devtools code.
  - The minimal entry has jsdom tests: defaults even with stored values, the load-time calls, the relay, and no host, user agent, rAF or console changes.
- **End-to-end:** Playwright (`@playwright/test`, Chromium) starts the `examples/basic-2d` dev server against the built package. It asserts the following:
  - globals exist before user code;
  - handlers fire on load and on control change;
  - the drawer toggles;
  - controls change globals;
  - values persist across a reload;
  - the random audio mock writes `engine.audio`;
  - `POST /canvas/event` reaches `onCanvasApiEvent`;
  - the build output contains no devtools code;
  - in `'minimal'` (a fixture project), globals and handlers work, values start at the defaults, `minimal.js` is loaded but never `index.js`, and there is no drawer host;
  - in `'none'`, there are no globals and the endpoint is 404.

  The suite is a separate script, `pnpm test:e2e`. It is not compatibility testing in SignalRGB's own renderers (§13).
- **CI:** build all examples as an end-to-end smoke test. A separate `e2e` job runs `pnpm build`, `pnpm exec playwright install --with-deps chromium` and `pnpm test:e2e`.
````

In §5.1, replace:

```markdown
- `devtools?: boolean | { fireChangedOnLoad?: boolean }`. Default `true`; applies in serve mode only. `fireChangedOnLoad` defaults to `true`, which mirrors SignalRGB's load-time calls (§3.2).
```

with:

```markdown
- `devtools?: 'none' | 'minimal' | 'full' | { mode?: 'none' | 'minimal' | 'full'; fireChangedOnLoad?: boolean }`. Default `'full'`; applies in serve mode only (§10.1). A string means `{ mode, fireChangedOnLoad: true }`. `fireChangedOnLoad` defaults to `true`, which mirrors SignalRGB's load-time calls (§3.2). Decision 2026-10-15: modes replace the boolean form; `true`/`false` are rejected.
```

In §2, change the "Out of scope for v1" row's last item from `Playwright compat tests.` to `Playwright compat tests in those renderers (Playwright end-to-end tests of the dev-mode devtools in Chromium are in scope, §11).`

In §13, change `- Native UltraLight/QtWebEngine runners and Playwright compat tests.` to `- Native UltraLight/QtWebEngine runners and Playwright compat tests in them.`

- [ ] **Step 4: Format and check**

Run: `pnpm format:fix && pnpm lint && pnpm format`
Expected: PASS. Prettier pads the Markdown tables.

Read `docs/devtools.md` once more against the code. Check in particular:
- the three modes, and that `'minimal'` keeps the defaults with nothing visible;
- the storage keys;
- the endpoint's status codes;
- that only Silent and Random are restored;
- that the Console tab counts five methods plus uncaught errors.

- [ ] **Step 5: Commit**

```bash
git add docs README.md packages/srgb-effect-kit/README.md examples/basic-2d/README.md examples/audio-visualizer/README.md .superpowers/specs/2026-10-13-srgb-effect-kit-design.md
git commit -m "docs: document the devtools and drop the dev-mode caveats" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The `.superpowers` directory is tracked; Prettier ignores it.

---


### Task 13: Release 0.1.0 locally and move butterchurn-srgb onto the devtools

butterchurn-srgb is a **separate repository**: `/home/ferret/Projects/Github/butterchurn-srgb`. It installs the toolkit from a committed tarball, `local_packages/srgb-effect-kit-0.0.0.tgz`, as a `file:` dependency. It still carries its own dev harness:
- `src/dev/` builds a meta-tag property form with Choices.js, adds localStorage persistence and an audio mock, and fires the handlers in a microtask;
- `setupDev()` is called in `src/main.ts`;
- a `nextpreset` window event and a "Next preset" button.

The toolkit's devtools replace all of it. The `NextPreset` boolean property already triggers `window.onNextPresetChanged = nextPreset` from the Properties tab.

**Files:**
- **Toolkit:** modify `packages/srgb-effect-kit/package.json` (`version`).
- **butterchurn-srgb:**
  - Delete `src/dev/` (`index.ts`, `properties.ts`, `controls.ts`, `audio.ts`, `utils.ts`, `dev.css`), `src/utils/events.ts` and `local_packages/srgb-effect-kit-0.0.0.tgz`.
  - Create `local_packages/srgb-effect-kit-0.1.0.tgz`.
  - Modify `src/main.ts`, `package.json`, `pnpm-lock.yaml` and `README.md`.

**Interfaces:**
- Consumes: the packed toolkit, whose `dist/devtools/index.js` is resolved by `dist/vite/index.js`.
- Produces: butterchurn-srgb runs in `pnpm dev` with the toolkit's drawer, with no dev code of its own and no `choices.js`.

- [ ] **Step 1: Bump and pack the toolkit**

In the toolkit, set `"version": "0.1.0"` in `packages/srgb-effect-kit/package.json`. The new tarball name makes pnpm reinstall it without forcing.

Run:

```bash
pnpm --filter srgb-effect-kit build
pnpm --filter srgb-effect-kit pack --pack-destination /home/ferret/Projects/Github/butterchurn-srgb/local_packages
tar -tzf /home/ferret/Projects/Github/butterchurn-srgb/local_packages/srgb-effect-kit-0.1.0.tgz | sort
```

Expected: the listing has `package/dist/devtools/index.js`, `package/dist/vite/index.js`, `package/dist/runtime/index.js`, `package/dist/runtime/index.d.ts`, `package/dist/vite/index.d.ts`, `package/client.d.ts`, `package/LICENSE`, `package/README.md` and `package/package.json`. It has no `src/`.

Commit in the toolkit:

```bash
git add packages/srgb-effect-kit/package.json
git commit -m "chore(kit): release 0.1.0 with devtools" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Branch butterchurn-srgb and swap the tarball**

```bash
cd /home/ferret/Projects/Github/butterchurn-srgb
git switch -c chore/srgb-effect-kit-devtools
git rm local_packages/srgb-effect-kit-0.0.0.tgz
```

In `package.json`, change the dependency to `"srgb-effect-kit": "file:local_packages/srgb-effect-kit-0.1.0.tgz"`. Then run:

```bash
pnpm remove choices.js
pnpm install
```

Expected: `pnpm-lock.yaml` points at the 0.1.0 tarball, and `choices.js` is gone from `package.json` and the lockfile.

- [ ] **Step 3: Delete the old harness**

```bash
git rm -r src/dev src/utils/events.ts
```

`src/utils/events.ts` (`dispatchWindowEvent`) was used only by `src/dev/controls.ts` for `nextpreset`. Check: `grep -rn "dispatchWindowEvent\|@/dev\|nextpreset\|choices" src` prints nothing after Step 4.

- [ ] **Step 4: Edit `src/main.ts`**

Remove these three lines at the top: the import, the blank line after the imports block, and the `setupDev` call.

```ts
import setupDev from '@/dev';
```

```ts
if (import.meta.env.DEV) setupDev({ properties: { persist: true } });
```

Also remove the custom window event and its comment. `window.onNextPresetChanged = nextPreset;` above it stays.

```ts
// Window events API
window.addEventListener('nextpreset', nextPreset);
```

Keep one blank line between `window.onNextPresetChanged = nextPreset;` and `// Load initial preset`, and let Prettier settle the rest. The import-sorting plugin keeps the remaining imports ordered.

- [ ] **Step 5: Update the README's Development section**

In `README.md`, replace step 3 of "Development":

```markdown
3. Go to [http://localhost:5173/butterchurn-srgb.html](http://localhost:5173/butterchurn-srgb.html) in your browser.
```

with:

```markdown
3. Open the URL Vite prints (`/` redirects to `/butterchurn-srgb.html`). Click **SRGB** in the bottom-right corner to open the srgb-effect-kit devtools: change the effect's properties (toggle "Next preset" to skip ahead), mock audio (Random, or System audio to visualize what you are playing), and check the 320×200 area SignalRGB shows.
```

- [ ] **Step 6: Lint, format and build**

Run: `pnpm lint && pnpm format && pnpm build`
Expected: all PASS. `pnpm build` regenerates the presets, runs `vite build` and type-checks both projects. If Prettier flags anything, run `pnpm format:fix` and re-run.

Then confirm the build has no devtools code:

```bash
grep -c "srgb-effect-devtools\|srgb-effect-kit:" dist/*.html
```

Expected: `0`.

- [ ] **Step 7: Check dev with Playwright**

Save this script outside both repos, as `${TMPDIR:-/tmp}/butterchurn-devtools-check.mjs`. It borrows the toolkit's Playwright install.

```js
import { chromium } from '/home/ferret/Projects/Github/srgb-effect-toolkit/node_modules/@playwright/test/index.mjs';

const base = 'http://127.0.0.1:5320';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH, // undefined → Playwright's own Chromium
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
const presetLogs = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.text().startsWith('Preset changed')) presetLogs.push(message.text());
});

await page.goto(`${base}/`);
const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
if (!page.url().endsWith('/butterchurn-srgb.html')) fail(`not redirected: ${page.url()}`);

const globals = await page.evaluate(() => ({
  preset: window.Preset,
  maxFps: window.MaxFPS,
  nextPreset: window.NextPreset,
  freq: window.engine?.audio.freq.length,
  oldHarness: document.getElementById('devtools') !== null,
}));
console.log('globals', globals);
if (globals.preset !== '# All' || globals.maxFps !== 60 || globals.nextPreset !== '0') {
  fail('property globals are not the manifest defaults in raw format');
}
if (globals.freq !== 200) fail('engine.audio mock missing');
if (globals.oldHarness) fail('the old #devtools harness is still rendered');

await page.locator('[data-srgb-devtools="toggle"]').click();
await page.locator('[data-srgb-control="NextPreset"]').waitFor();
await page.waitForTimeout(1500);
const before = presetLogs.length;
await page.locator('[data-srgb-control="NextPreset"]').check();
await page.waitForTimeout(1500);
if (presetLogs.length <= before) fail('toggling NextPreset did not load another preset');

await page.locator('[data-srgb-devtools-tab="audio"]').click();
await page.locator('[data-srgb-audio-mode="random"]').click();
await page.waitForTimeout(300);
const level = await page.evaluate(() => window.engine.audio.level);
if (!(level > -100)) fail(`random audio did not write engine.audio (level ${level})`);

if (errors.length > 0) fail(`page errors: ${errors.join(' | ')}`);
await browser.close();
console.log(process.exitCode ? 'butterchurn dev check FAILED' : 'butterchurn dev check passed');
```

Run it. Start the dev server in the background (`predev` regenerates the presets first), and wait until it prints its URL:

```bash
cd /home/ferret/Projects/Github/butterchurn-srgb
pnpm dev --host 127.0.0.1 --port 5320 --strictPort
```

Then, in another shell:

```bash
CHROMIUM_PATH=/usr/bin/chromium node "${TMPDIR:-/tmp}/butterchurn-devtools-check.mjs"
```

Stop the dev server afterwards.

Expected:
- the script prints `butterchurn dev check passed`;
- the globals line shows `preset: '# All'`, `maxFps: 60`, `nextPreset: '0'` and `freq: 200`.

If WebGL fails to start in a GPU-less environment, add `args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader']` to `chromium.launch`.

- [ ] **Step 8: Commit in butterchurn-srgb**

```bash
git add -A
git status --short   # expect: deleted src/dev/*, src/utils/events.ts, the 0.0.0 tarball; new 0.1.0 tarball; modified src/main.ts, package.json, pnpm-lock.yaml, README.md
git commit -m "chore: use srgb-effect-kit devtools instead of the local dev harness" -m "Drop src/dev, choices.js and the nextpreset window event; the NextPreset property covers it." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Do not push or merge. Leave the branch for the user to review.

---

## Follow-up

**Plan 3: Probe** (spec §9). Its findings replace this plan's placeholders, each in one place:
- `SIMULATED_USER_AGENTS` (and `RENDERER_SIGNATURES`);
- the raw formats (`coerceRaw`/`defaultRaw`);
- the load-time order and timing (`onDomReady` plus `fireAll`);
- the zone value scale (`zones.ts`);
- `getFrequencies`' range.
