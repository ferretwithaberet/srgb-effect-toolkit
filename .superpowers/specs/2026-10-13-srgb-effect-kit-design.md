# srgb-effect-kit — Design

Date: 2026-10-13
Status: Approved in brainstorming, pending written-spec review

## 1. Purpose

A toolkit that helps developers build SignalRGB **effects** (Lightscripts): single HTML files that SignalRGB loads, whose `<head>` declares metadata, user controls and screen meters as `<meta>` tags, and whose top-left 320×200 viewport region SignalRGB displays and maps onto RGB devices.

The toolkit targets effects only (not SignalRGB plugins, macros, etc.).

Problems it solves:

1. The SignalRGB environment (injected property globals, `on<Prop>Changed` callbacks, `engine.*`, meters, canvas API events) does not exist in a normal browser.
2. `<meta>` declarations and the code that consumes them drift apart; nothing types the injected globals.
3. The shipped artifact must be one self-contained HTML file that runs in both SignalRGB renderers.

Prior art: `/home/ferret/Projects/Github/butterchurn-srgb` (hand-written `signalrgb.d.ts`, dev harness with property form + localStorage persistence + audio mock, inline single-file build, FPS-capped render loop).

### Success criteria

- An effect project is a normal Vite project: `vite` for dev, `vite build` for a single deployable HTML file.
- All properties, change handlers, meters and `engine` are typed as globals, both bare (`speed`) and on `window` (`window.speed`).
- In dev, a devtools drawer simulates everything the Lightscripts docs describe (controls, audio, screen zones, meters, canvas API events) plus renderer/FPS behaviour.
- A probe effect, run in real SignalRGB (Windows VM), produces machine-readable facts that the toolkit's defaults are based on.

## 2. Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Repo shape | pnpm workspace; one published package `srgb-effect-kit` in `packages/srgb-effect-kit`; `examples/*` consume it via `workspace:*`. Split into more packages only on a concrete trigger (scaffolder, large component library, standalone simulator). |
| Package name | `srgb-effect-kit` (name must contain "effect"). |
| Source of truth | Effect manifest is passed as Vite plugin options in `vite.config.ts`. Plugin generates `<meta>` tags and a generated, git-ignored `.d.ts` declaring globals. |
| Ordering | `properties` and `meters` are **arrays** (order = UI order / declaration order), not objects. |
| Runtime philosophy | The toolkit mostly types what SignalRGB provides, and offers utilities only where they are necessary or significantly ease effect creation. No thin wrappers: properties, `on<Prop>Changed`, `onCanvasApiEvent` and `engine` (or `window.engine`) are used directly as typed globals. |
| Projects | One effect per Vite project. |
| Canvas | Optional. No validation of canvas presence or size. Content may extend beyond 320×200; SignalRGB shows only the top-left 320×200. |
| Testing against real SignalRGB | Windows VM running SignalRGB is the source of truth (probe effect). Daily dev happens in the browser with devtools. |
| Out of scope for v1 | CLI, deploy-to-folder, LED sampling preview, scaffolder (`create-srgb-effect`), native UltraLight/QtWebEngine runners, Playwright compat tests in those renderers (Playwright end-to-end tests of the dev-mode devtools in Chromium are in scope, §11). |

## 3. Background facts

### 3.1 From the Lightscripts docs (https://docs.signalrgb.com/developer/lightscripts/)

- Effect = single HTML file. `<title>` is the effect name in SignalRGB. Informational meta use the attribute name as key: `<meta description="…"/>`, `<meta publisher="…"/>`.
- Six control types, attributes `property`, `label`, `type`, `default`, optional `tooltip`:
  - `number`: `min`, `max` (whole numbers).
  - `hue`: `min` (≥0), `max` (≤360).
  - `boolean`: default `0` or `1`.
  - `color`: default in hex; docs examples also carry `min="0" max="360"`.
  - `textfield`: default may be empty; updates on every keystroke.
  - `list`: `values` comma-separated; `default` must be one of them.
- The `property` name becomes a global variable, read live.
- Screen meters: `<meta meter="name" type="…" x y …>`, normalized 0–1 coordinates. Types:
  - `linear`: `width`, `h`/`s`/`l` as `"min-max"`. Value is the fraction of matching pixels (0–1).
  - `area`: `width`, `height`, `h`/`s`/`l`. Value is the fraction of matching pixels (0–1).
  - `ocr_textmatch`: `width`, `height`, `string`, `confidence` (default 70). Value is 1, 0 or −1.
  - `ocr_numeric`: `width`, `height`, `confidence`. Value is the integer read, or −1.
  - Optional attributes: `tags="a,b"`, `hdr-h`/`hdr-s`/`hdr-l`.
  - Child `<resolution size="WxH" …/>` or `<resolution aspect="W:H" …/>` overrides. With these children the meter tag must be written as non-void `<meta …>…</meta>`.
  - Values are read via `engine.vision.<name>`.
- Meter rules:
  - Meters must not extend beyond the screen; doing so crashes SignalRGB.
  - Names must be unique.
  - A faulty meter can disable the meters declared after it.
- `engine.audio`:
  - `level`: −100..0.
  - `width`: 0..1.
  - `density`: 0..1.
  - `freq`: 200 elements; values can be negative.
- `engine.zone.{hue,saturation,lightness}`: 560-element arrays forming a 28×20 screen grid.
- `onCanvasApiEvent(apiEvent)`:
  - Called with `apiEvent.sender` and `apiEvent.event`.
  - Triggered by `POST http://localhost:16034/canvas/event?sender=…&event=…`.
- Testing requirements:
  - Clean console: only "Loading Effect".
  - Sliders should ideally range 0–100.
- The render loop is convention only (`update()` plus `requestAnimationFrame`); the engine calls no hook.
- Doc snippets contain syntax errors. Do not copy them verbatim.

### 3.2 From the user / SignalRGB developers (not in docs)

- `on<Prop>Changed` globals are called by SignalRGB when a property changes. They are also called once at load: butterchurn-srgb, which the user verified in real SignalRGB, applies initial state only inside these handlers. Exact order and timing will be confirmed in a later probe pass.
- Users choose the renderer: **UltraLight** or **QtWebEngine**.
- SignalRGB has an FPS setting (20–60). Effects likely do not receive it.
  - UltraLight's rAF follows the setting.
  - QtWebEngine's rAF runs at 60 Hz while SignalRGB pulls frames at the setting's rate.
- SignalRGB displays only the top-left 320×200 of the page.

### 3.3 Unknown, to be determined by the probe (§9)

- Runtime raw types of `boolean`, `color` and `list` values.
- Exact order and timing of the load-time `on<Prop>Changed` calls.
- UA signatures of both renderers.
- Viewport size.
- JS/ES feature level and `type="module"` support.
- WebGL support.
- Network/`fetch` access.
- Exact `engine` shape, including undocumented keys and whether `freq` is an Array or a typed array.
- Whether meters are also exposed as bare globals.
- `onCanvasApiEvent` argument shape.
- Doctype handling.

## 4. Repository and package layout

```text
srgb-effect-toolkit/                  pnpm workspace (not published)
├─ packages/srgb-effect-kit/
│  ├─ src/
│  │  ├─ shared/     manifest types, validation, meta serializer, typegen (isomorphic: no DOM, no Node)
│  │  ├─ runtime/    browser utilities shipped inside effects
│  │  ├─ vite/       plugin
│  │  └─ devtools/   dev-only browser UI + mocks (internal entry, not a public export)
│  └─ package.json
├─ examples/
│  ├─ basic-2d/
│  ├─ audio-visualizer/
│  └─ probe/
└─ docs/
```

### Exports

| Subpath | Contents | Environment |
|---|---|---|
| `srgb-effect-kit` | runtime utilities (§7) | browser, zero dependencies |
| `srgb-effect-kit/vite` | `srgbEffect()` plugin, option types | Node, `vite` peer dependency |
| `srgb-effect-kit/client` | ambient types: `engine`, `onCanvasApiEvent`, `SRGBVision`, `SRGBBoolean` (re-exposed from the runtime's globals module) | types only |

The devtools are built as an internal dist entry. The plugin resolves that entry by file path.

### Boundary rules (enforced by lint)

- `runtime/` imports only `shared/`. It must not import `node:*` or `vite`.
- `devtools/` imports `shared/` and `runtime/`.
- `vite/` imports `shared/`, plus `node:*` and `vite`.

### Tooling

- TypeScript (strict), ESM-only package.
- `tsdown` for the library build; `vitest` (with jsdom where needed) for tests.
- ESLint and Prettier, configured like butterchurn-srgb.
- Vite 8 as a peer dependency.
- Node pinned via `mise.toml`; pnpm via `packageManager`.

## 5. Manifest (plugin options)

```ts
import { defineConfig } from 'vite';
import { srgbEffect } from 'srgb-effect-kit/vite';

export default defineConfig({
  plugins: [
    srgbEffect({
      title: 'Hue Cycle',
      description: 'Rainbow wave',
      publisher: 'ferret',
      properties: [
        { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50, tooltip: 'Cycle speed' },
        { property: 'baseHue', type: 'hue', label: 'Hue', default: 120 },
        { property: 'rainbow', type: 'boolean', label: 'Rainbow', default: true },
        { property: 'tint', type: 'color', label: 'Tint', default: '#009bde' },
        { property: 'text', type: 'textfield', label: 'Text', default: '' },
        { property: 'mode', type: 'list', label: 'Mode', values: ['Wave', 'Pulse'], default: 'Wave' },
      ],
      meters: [
        {
          meter: 'health', type: 'linear', x: 0.05, y: 0.9, width: 0.189,
          h: [70, 140], s: [40, 100], l: [40, 100],
          tags: ['vlc'],
          resolutions: [{ size: '1920x1080', x: 0.0557, y: 0.9083, width: 0.199 }],
        },
      ],
    }),
  ],
});
```

### 5.1 Option types

- `title: string` (required), `description?: string`, `publisher?: string`.
- `properties?: readonly PropertyDef[]`. Every def has `property`, `type`, `label`, `default` and optional `tooltip`.
  - `number`: `min`, `max`, `default: number`.
  - `hue`: `min?` (default 0), `max?` (default 360), `default: number`.
  - `boolean`: `default: boolean`. Serialized as `"0"`/`"1"`.
  - `color`: `default` as `#rrggbb`. Serialized with `min="0" max="360"`, matching the docs.
  - `textfield`: `default: string`.
  - `list`: `values: readonly string[]`, `default` must be one of `values`.
- `meters?: readonly MeterDef[]`. Every def has `meter`, `type`, `x`, `y`, and optional `tags?: string[]` and `resolutions?: ResolutionDef[]`.
  - `linear`: `width`, `h`, `s`, `l` as `[min, max]` tuples, optional `hdr?: { h, s, l }`.
  - `area`: `width`, `height`, `h`, `s`, `l`, optional `hdr?`.
  - `ocr_textmatch`: `width`, `height`, `string`, optional `confidence` (default 70).
  - `ocr_numeric`: `width`, `height`, optional `confidence` (default 70).
  - `ResolutionDef`: either `{ size }` (template-literal type `"<W>x<H>"`, e.g. `'1920x1080'`) or `{ aspect }` (`"<W>:<H>"`, e.g. `'21:9'`), combined with an optional subset of `x`, `y`, `width`, `height`.
- `typesFile?: string`. Default `src/srgb-effect.d.ts`.
- `fileName?: string`. Default is the kebab-cased `title` plus `.html`.
- `script?: 'classic' | 'module'`. Default `'module'` (§8). Decision 2026-10-15: follow Vite conventions, since SignalRGB already loads butterchurn-srgb, which ships an inline `<script type="module">`; `'classic'` stays as opt-in.
- `dropConsole?: boolean`. Default `true`.
- `target?: string | string[]`. Default `'es2020'`, provisional until the probe (§9).
- `devtools?: 'none' | 'minimal' | 'full' | { mode?: 'none' | 'minimal' | 'full'; fireChangedOnLoad?: boolean }`. Default `'full'`; applies in serve mode only (§10.1). A string means `{ mode, fireChangedOnLoad: true }`. `fireChangedOnLoad` defaults to `true`, which mirrors SignalRGB's load-time calls (§3.2). Decision 2026-10-15: modes replace the boolean form; `true`/`false` are rejected.

`srgbEffect` uses a `const` type parameter so literal types are preserved. That gives config-time type errors for mistakes such as a `list` default that is not in `values`.

### 5.2 Validation

Validation lives in `shared/` and runs on plugin config. Failures throw errors that name the offending entry.

- **Property names:**
  - Must be valid JS identifiers and unique.
  - Must not collide with `Window`/`globalThis` built-ins (`name`, `top`, `status`, `length`, `close`, …). The list is a static table generated from `lib.dom` at package build time.
  - Must not collide with SignalRGB globals (`engine`, `onCanvasApiEvent`).
- **`number`:** `min ≤ default ≤ max`, all integers.
- **`hue`:** `0 ≤ min ≤ default ≤ max ≤ 360`.
- **`color`:** `default` matches `/^#[0-9a-f]{6}$/i`.
- **`list`:**
  - `values` is non-empty and unique.
  - No value contains a comma, because the comma is the serialization separator.
  - `default` is in `values`.
- **Meters:**
  - Names are unique valid identifiers.
  - Required fields are present for the type.
  - All coordinates and sizes are in 0–1, with `x + width ≤ 1` and `y + height ≤ 1`. The same holds for each resolution override after merging with the base.
  - `h` ranges are within 0–360; `s` and `l` within 0–100; every range has `min ≤ max`.
  - `confidence` is within 0–100.
  - Resolution `size`/`aspect` strings are well-formed.

### 5.3 Meta serialization

The plugin emits the following into `<head>`, in this order:

1. `<title>`
2. `<meta description>`
3. `<meta publisher>`
4. Properties, in array order
5. Meters, in array order

Attribute values are HTML-escaped.

- A meter without resolutions is emitted as `<meta … />`.
- A meter with resolutions is emitted as `<meta …>` followed by `<resolution …/>` children and a closing `</meta>`.
- Range tuples are serialized as `"min-max"`. `hdr` becomes `hdr-h`/`hdr-s`/`hdr-l`. `tags` is comma-joined.

`index.html` must not contain `<title>` or SignalRGB `<meta>` tags, since the config is the source. The plugin errors if it finds them. All other head content (styles, etc.) is kept.

### 5.4 Generated types

On every `configResolved`, the plugin writes `typesFile`. It writes only when the content changed, to avoid watcher loops. Decision 2026-10-15: the file is **git-ignored**, not committed, because it is generated. Vite regenerates it on every `vite` and `vite build`, so on a fresh clone `tsc` needs Vite to run first: users change the template's `tsc && vite build` to `vite build && tsc`, and `pnpm dev` once also generates it for the editor.

```ts
/* eslint-disable */
// Generated by srgb-effect-kit. Do not edit.
/// <reference types="srgb-effect-kit/client" />
declare global {
  var speed: number;
  var baseHue: number;
  var rainbow: SRGBBoolean;        // raw type finalized by probe
  var tint: string;
  var text: string;
  var mode: 'Wave' | 'Pulse';

  var onSpeedChanged: (() => void) | undefined;
  var onBaseHueChanged: (() => void) | undefined;
  var onRainbowChanged: (() => void) | undefined;
  var onTintChanged: (() => void) | undefined;
  var onTextChanged: (() => void) | undefined;
  var onModeChanged: (() => void) | undefined;

  interface SRGBVision { health: number }
}
export {};
```

`declare global { var … }` types both the bare form (`speed`, `onSpeedChanged = …`) and the `window.` form. The handler name is `on` + the property name with its first letter capitalized + `Changed`.

## 6. Global-scope safety

Two pitfalls follow from effect code being bundled as modules.

1. **Bare assignment in strict code.** `onSpeedChanged = () => …` throws `ReferenceError` if the global property does not exist. To prevent this, a prelude runs before user code. In build output it is prepended to the bundle; in dev the devtools bootstrap provides it. For each property, the prelude does `if (!('onXChanged' in window)) window.onXChanged = undefined;`.
2. **Module-scoped function declarations.** A top-level `function onSpeedChanged() {}` in a module never becomes global, so SignalRGB never calls it, and TypeScript does not complain. The plugin's `transform` hook covers this case:
   - It parses user modules, excluding `node_modules`.
   - It warns on top-level function declarations named `on<Prop>Changed` for a declared property, or `onCanvasApiEvent`.
   - The warning suggests `window.onXChanged = …`.

## 7. Runtime utilities (`srgb-effect-kit`)

These are standalone functions. Nothing here is required to use SignalRGB features. There is no canvas or engine accessor: use `document.querySelector('canvas')` and the typed `engine` global directly. The audio and zone helpers default to `globalThis.engine` (guarded, since it is undefined outside SignalRGB) and also accept an explicit argument.

| Area | API |
|---|---|
| Loop | `createLoop(frame: (info: { dt: number; time: number; frameCount: number }) => void, opts?: { maxFps?: number })` → `{ start(), stop(), setMaxFps(n), running }`. Built on rAF; the FPS cap uses time accumulation (no lodash). `dt` is in seconds. |
| Renderer | `detectRenderer(): 'ultralight' \| 'qtwebengine' \| 'browser'`, `isSignalRGB(): boolean`. Based on the UA, using signatures recorded by the probe. |
| Audio | `isSilent()`, using the level check and spectrum-sum threshold proven in butterchurn-srgb. `getFrequencies(): number[]` returns 200 sanitized values; garbage and non-finite entries become 0, and final range semantics come from the probe. |
| Screen zones | `getZone(x: 0–27, y: 0–19)` → `{ h, s, l }`. `getZones()` → 560 `{ h, s, l }` in row-major order. |
| Meters | `createMeter(size, callback)` → `{ value, diff, increased, decreased, setValue(v) }`. A typed port of the docs' `Meter` class: the callback fires only after `size` identical consecutive values that differ from the current value. |
| Color | `hexToRgb`, `rgbToHex`, `rgbToHsl`, `hslToRgb`, `hexToHsl`, `hslToHex`, `hsl(h, s, l, a?)`, `rgb(r, g, b, a?)`, `lerpColor(a, b, t)`. |
| Booleans | `parseBoolean(v: SRGBBoolean \| boolean \| number): boolean`. Tolerates every plausible raw form until the probe settles the real one. |

The globals are typed once, in the runtime's globals module (`src/runtime/globals.ts`), whose `declare global` block ships in `dist/runtime/index.d.ts`. `srgb-effect-kit/client` only brings that block into scope (`/// <reference path="./dist/runtime/index.d.ts" />`); it does not redeclare anything. The module also exports `SRGBEngine`, `EngineAudio`, `EngineZone`, `CanvasApiEvent` and `SRGBBoolean`.

```ts
// src/runtime/globals.ts
declare global {
  interface SRGBVision {}   // augmented by generated types
  type SRGBBoolean = '0' | '1'; // provisional (matches butterchurn-srgb usage); finalized by probe
  var engine: SRGBEngine;   // { audio: EngineAudio; zone: EngineZone; vision: SRGBVision }
  var onCanvasApiEvent: ((event: CanvasApiEvent) => void) | undefined;
}
```

## 8. Build output (`vite build`)

The entry is the user's `index.html`. The user owns the body: canvas, extra DOM, or no canvas at all.

### 8.1 Single-file output

The plugin's `config` hook:

- disables code splitting (single JS chunk, dynamic imports inlined) and CSS code splitting;
- inlines all assets (`assetsInlineLimit` always true);
- disables the module-preload polyfill.

Then `generateBundle` (`enforce: 'post'`):

1. Replaces `<script src>` and `<link rel="stylesheet">` with inline content.
2. Deletes the now-inlined chunks and assets. `dist/` must contain exactly one HTML file; any remaining non-HTML output is a build error.
3. **Script format:**
   - By default (`script: 'module'`, decided 2026-10-15 to follow Vite conventions; SignalRGB already loads butterchurn-srgb, which ships an inline `<script type="module">`), it emits one inline `<script type="module">` at the end of `<body>`. Imports are bundled into it. Module scripts are already strict and module-scoped, so top-level declarations cannot collide with property globals, and the classic-only rejections below do not apply.
   - With `script: 'classic'` (opt-in), it wraps the bundle in an IIFE and emits a classic `<script>` at the end of `<body>`.
     - The IIFE keeps top-level declarations from leaking into global scope and colliding with property globals.
     - It errors if the output contains `import.meta` (other than Vite-replaced `import.meta.env`), top-level `await`, `import` or `export`.
4. Prepends the §6 prelude to the bundle.
5. **Final string pass:** injects the §5.3 head markup. String operations are required because of the non-void meter `<meta>` elements; an HTML parser would mangle them.

It then logs the output size.

### 8.2 Other build settings

- `build.target` comes from the `target` option (provisional `es2020`).
- `dropConsole` maps to the bundler's console/debugger drop option, to meet the clean-console requirement.
- Doctype: verified 2026-10-16 in real SignalRGB, an effect file starting with `<!doctype html><html>` is listed but never applies when clicked; without the doctype and `<html>` wrapper it works. Decision (2026-10-16): the build strips the doctype, `<html …>` and `</html>` in its final string pass (`stripDocumentWrapper`), so output starts with `<head>`. Dev serving keeps the doctype for standards-mode preview.

## 9. Probe effect (`examples/probe`)

Revised 2026-10-16: the user chose a console-only probe and asked for a test-plan document. The dev-server endpoint, the saved result files and the paged on-screen report of the first version are dropped.

A diagnostic effect built with the toolkit itself. It is loaded in real SignalRGB once per renderer (UltraLight, QtWebEngine), at several FPS settings. It declares one property of every control type (`pNumber`, `pHue`, `pBool`, `pColor`, `pText`, `pList`) and one meter of every type (`mLinear`, `mArea`, `mText`, `mNumber`). The manifest lives in `src/manifest.ts`, shared by two configs:

- `vite.config.ts`: title `SRGB Probe`, `script: 'module'`, output `dist/probe.html`.
- `vite.config.classic.ts`: title `SRGB Probe Classic`, `script: 'classic'`, output `dist/probe-classic.html`, `build.emptyOutDir: false`.

Both set `dropConsole: false`, since the console is the probe's only output, and `target: 'es2015'`, so the probe itself runs on engines below the provisional `es2020` default. A build tag (`'module'` or `'classic'`) comes from `define` on `import.meta.env.PROBE_BUILD`.

### 9.1 What it records

Each section is logged as soon as it is known:

- **`start`** (immediately): `performance.now()`, `readyState`, URL and protocol, `document.currentScript` (null for modules), doctype, build tag.
- **`env`:** user agent, platform, language, cores, inner/outer size, DPR, screen size, `compatMode`, visibility, focus, canvas client vs. backing size, `detectRenderer()`.
- **`globals`:** names on `window` that a fresh `about:blank` iframe window lacks, each with its `typeof`. Without an iframe, a heuristic filter (no `on*`, `webkit*` or built-in constructors) marked `fallback`. Recomputed in each REPORT, to catch late injection.
- **`properties`:** raw value, `typeof`, constructor and `in window` per property, and the `typeof` of each handler before the probe assigns it.
- **`changed`** (live): the probe assigns every `on<Prop>Changed`. Each call logs the property, a sequence number, time, `readyState`, whether `DOMContentLoaded`/`load` have fired, the arguments, `this === window` and the raw value. **`canvas-event`** (live) logs the full `onCanvasApiEvent` payload, its keys and type. **`lifecycle`** logs `DOMContentLoaded` and `load`.
- **`engine`:** the deep shape of `engine` to depth 4: `typeof`, constructor, `Array.isArray`, length and samples per key, plus whether `engine` is an own property of `window`.
- **`meters`:** `engine.vision.<meter>` and whether each meter is also a bare global.
- **`features`** (once the async checks settle): ES syntax checks via `new Function` (optional chaining through static blocks, BigInt, RegExp lookbehind and named groups, async generators, `for await`); `typeof` of a list of builtins and web APIs; WebGL 1/2 with version, unmasked renderer and max texture size; 2D canvas `filter`; a Blob-URL Worker (2 s timeout); `fetch` of a `data:` URL and of a network URL (3 s timeout); a localStorage counter that shows persistence across restarts.
- **`timing`** (at 5 s): rAF count, average/min/max interval, Hz, timestamp type and monotonicity, first timestamp vs. `performance.now()`; actual `setInterval(…, 100)` period.
- **`audio`** (at 5 s, sampled every frame): ranges of `level`, `width`, `density`; `freq` length, constructor, range, negative and non-finite counts, object identity reuse between frames, first sample; extra keys on `engine.audio`.
- **`zone`** (at 5 s): length, constructor, range and sample of each channel.
- **`REPORT`** (at 6 s, then every 30 s): every section plus the latest `changed` and `canvas-event` records, in one line.

Every collector is wrapped: a failure logs `<section>-error {message, stack}` and the probe continues. Missing globals (a plain browser, `file://`) are reported as data, not errors.

### 9.2 How it reports

- **Console only.** Every line is `[probe] <section> <json>`, one line each. The serializer never throws: typed arrays and arrays over 64 entries become length plus a 16-value sample, functions become `'function'`, `NaN`/`Infinity` become strings, cycles become `'[cycle]'`, depth is limited to 4.
- **Canvas status.** The 320×200 canvas shows the title, build tag, `detectRenderer()`, the measured Hz, when the report was logged and the `changed`/`canvas-event` counts, redrawn every second. It confirms the probe is alive; the data is in the console.
- **Test plan.** `examples/probe/TEST-PLAN.md` is the protocol for the user: build and install, where to read the console, a run checklist (U1–U6 for UltraLight, Q1–Q6 for QtWebEngine: FPS 60/30/20, silence, the classic build, a restart for storage persistence, control changes and a `curl` canvas API event), what to send back, and troubleshooting. The user copies the `[probe]` lines of each run and hands them back.
- The doctype question is settled (§8.2): both builds are emitted without the doctype and `<html>` wrapper.
- **Hardening after review (2026-10-16).** An inline ES5 `<head>` script logs `alive` before the bundle and hooks errors as `window-error`. Lines over about 3000 characters are split into `<section>#i/n` chunks; strings are capped at 500 characters and objects at 200 keys. REPORT is logged in full three times (about 6 s, 36 s, 66 s), then only as `REPORT-delta`. `env`, `engine`, `meters` and `properties` are logged again at 5 s (`…@5s`) and in each REPORT (`…AtReport`). Features log per group (`features-syntax`, `-builtins`, `-canvas`, `-storage` at start; `-webgl`, `-worker`, `-fetch` after the timing window), with ES2015–ES2019 syntax checks and a `functionConstructor` control. `meters-live` samples meters every frame; `engineUpdates` measures the audio data refresh rate; timing adds `performance.now()` intervals and median/p95.

### 9.3 Where findings go

Findings are recorded in `docs/probe-findings.md`, written later from the `[probe]` lines the user sends back, and feed into:

- `detectRenderer` signatures
- the default `target` and `script`
- raw types in the generated `.d.ts`
- devtools defaults: load-time firing, renderer UA strings, viewport

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
- **The bootstrap.** The full entry, synchronously, at module top level, does the following in this order (`devtools/index.ts`, then `startSimulation()` in `simulation.ts`). The minimal entry does steps 3–6 only (with defaults), through the same `startSimulation()`.
  1. Applies the persisted renderer simulation: the user agent and, for UltraLight, the rAF throttle.
  2. Wraps the console for the Console tab.
  3. Defines every `on<Prop>Changed` and `onCanvasApiEvent` global that does not exist (the prelude guarantee, from `handlerGlobalNames`).
  4. Sets every property global from localStorage or the default, in raw format. Invalid stored values fall back to the default; numbers are clamped and rounded.
  5. Installs the `engine` mock:
     - `audio`: silent;
     - `zone`: 560-cell arrays;
     - `vision`: every meter at 0, and −1 for `ocr_numeric`.
  6. Subscribes to the canvas-event relay.
  7. Creates the audio and screen controllers, which restore the audio mode and the screen source (solid or gradient only).

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
- **Open state.** When open, it docks bottom or right and is resizable by dragging its inner edge, between 160 px and 90% of the viewport. A drag applies size changes once per animation frame and persists only when it ends. Switching dock or resizing the window clamps the rendered size but keeps the saved preference. Open state, dock side, size, selected tab and marker toggles are persisted.
- **Tabs.** Each tab is created the first time it is selected. Tabs that do periodic work run it only while visible.
- **Implementation.** Vanilla TypeScript, with the CSS as a TS string. There is no UI framework and no runtime dependency.

### 10.4 Tabs

| Tab | Behaviour |
|---|---|
| Properties | One control per type, in manifest order: number → slider plus value; hue → slider with a hue-gradient track for its min–max; boolean → checkbox; color → color input; textfield → text input, firing per keystroke; list → `<select>`. A change sets the global in raw format, persists it, then calls `window.on<Prop>Changed?.()`. Unchanged values do not fire. "Reset to defaults" fires only for values that change. |
| Audio | Modes: silent, random, microphone (`getUserMedia`) and system (`getDisplayMedia` audio). `engine.audio.{level, width, density, freq[200]}` is written in place: once when silent is selected, and on every native animation frame for random and the captures. Live audio gives `level` = RMS dB of the mix, `width` = side/(mid+side) RMS, `density` = spectral flatness, and `freq` = 200 byte bands of a 512-point FFT. Choosing a capture mode stores `silent`, so only silent and random are restored after a reload. A failed capture (permission denied, no audio track shared, a read error, or `[srgb-effect] audio capture needs a secure context (https or localhost)` when `navigator.mediaDevices` is missing) returns to silent and shows a text error. When the user ends the share, it also returns to silent and shows the status `Audio capture ended.`. |
| Screen | Sources: solid color, left-to-right gradient, and screen capture (`getDisplayMedia` video). A capture is sampled every 100 ms at 480 px wide and averaged into the 28×20 grid, which writes the `engine.zone` arrays (hue 0–360, s/l 0–100, provisional). The preview shows the grid or, while capturing, the frame with meter regions outlined. A capture is never restored after a reload. A failed capture (including `[srgb-effect] screen capture needs a secure context (https or localhost)` when `navigator.mediaDevices` is missing) returns to the previous solid or gradient source, or to black after a read error, and shows a text error. When the user ends the share, it returns to the previous source and shows the status `Screen capture ended.`. |
| Meters | A manual value control per meter: `linear`/`area` 0–1, `ocr_textmatch` −1/0/1, `ocr_numeric` an integer ≥ −1. Partial input such as `-` is kept while typing and committed on change. Values are clamped and persisted, and written to `engine.vision.<name>`. While a screen capture is active, `linear` and `area` values are computed from the captured pixels. The region is the base region, or the resolution override that matches the capture's size exactly or its aspect within 3%. The value is the fraction of pixels inside the meter's h/s/l ranges. `hdr` ranges are not simulated, and OCR meters stay manual. |
| Canvas API | A sender/event form (persisted) that calls `window.onCanvasApiEvent?.({ sender, event })`, the equivalent `curl` command, and a history of the last 20 events from both sources. The dev server serves `POST /canvas/event?sender=…&event=…` at that path whatever the `base`. Missing parameters become `''`. It answers 204 with `Access-Control-Allow-Origin: *`, and 405 for other methods; Vite's CORS middleware answers preflights. Requests are relayed over Vite's WebSocket (`server.ws.send('srgb-effect:canvas-event', …)` → `import.meta.hot.on`). |
| Renderer | Simulates `browser` / `ultralight` / `qtwebengine` together with an SRGB FPS setting (20–60). The simulation overrides `navigator.userAgent` with placeholder UA strings until the probe runs; these are the runtime's renderer test fixtures, so `detectRenderer()` needs no dev hook. UltraLight simulation replaces `requestAnimationFrame`/`cancelAnimationFrame` with a throttle at the FPS setting; QtWebEngine leaves rAF at the native rate. Changing the renderer reloads the page, while the FPS applies live. The tab shows the measured rAF rate. |
| SignalRGB view | A scaled-up (2×), pixelated live copy of the visible 320×200, sampled at the FPS setting. If a canvas covers the region, it is sampled directly; WebGL needs `preserveDrawingBuffer: true`. Otherwise, opt-in tab capture (`getDisplayMedia` with `preferCurrentTab`) is cropped to the region. It is never restored and stops when the tab is hidden; without `navigator.mediaDevices` it reports `[srgb-effect] tab capture needs a secure context (https or localhost)`. |
| Console | Counts `console.log`/`info`/`warn`/`error`/`debug` calls and uncaught errors/unhandled rejections, ignoring Vite's `[vite]` messages. The total shows as the toggle badge (the clean-console requirement); the badge and the tab update once per frame. |

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
- **Restored capture modes.** Capture modes (audio and screen) are not restored after a reload, because they need a user gesture. Failed captures fall back to silent (audio) or the previous solid/gradient source (screen) with a text error.
- **Drawer sizing.** The drawer is resizable by drag, with the preferred size kept apart from the clamped rendered size.
- **Endpoint details.** The status codes, CORS, the base-independent path and empty-string defaults are now specified.
- **Specified simulation math.** The audio math, the zone scale, the capture sampling rate, the meter evaluation (no `hdr`, aspect within 3%) and the initial meter values are now specified.

## 11. Testing

All tests use vitest.

- **`shared/`:** unit tests for every validation rule and for meta serialization, including meters with `<resolution>` children, `hdr`, `tags` and escaping. Snapshot tests for typegen output.
- **`vite/`:** integration tests that build fixture projects and assert:
  - exactly one HTML file in `dist/`;
  - assets inlined;
  - head markup present and correctly ordered;
  - IIFE wrapper and prelude;
  - errors on `import.meta` and top-level `await`;
  - errors on a `<title>` or SignalRGB meta in `index.html`;
  - the module-scope function warning;
  - generated `.d.ts` written only on change.
- **`runtime/`:** unit tests (jsdom) for the loop (fake timers/rAF), color conversions, zones, audio helpers, `createMeter`, and `detectRenderer` (UA fixtures from the probe).
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

## 12. Documentation

- Package README covering:
  - install and setup;
  - config reference;
  - how globals are typed;
  - global-scope pitfalls (§6);
  - devtools overview;
  - the renderer/FPS notes.
- A README per example.
- `docs/probe-findings.md`: verified SignalRGB facts with date, SignalRGB version and renderer.

## 13. Deferred (not in v1)

- CLI (typegen, deploy).
- Deploy-to-Effects-folder.
- LED sampling preview with mock device layouts.
- `create-srgb-effect` scaffolder.
- Native UltraLight/QtWebEngine runners and Playwright compat tests in them.
- Keypress/"tap effect" APIs. These are undocumented; add them if the probe discovers them.

## 14. Risks

- **Probe-dependent defaults.** Raw types, target, script format and load-time firing are provisional until the probe runs. The design isolates each of them behind one option or one table, so updating them is local.
- **VM fidelity.** Without GPU passthrough, QtWebEngine may fall back to software rendering, which could affect WebGL and timing results. Findings must be labelled with the VM context, and spot-checked on bare metal (dual-boot) when results look suspicious.
- **String-based HTML post-processing.** This is fragile against unusual `index.html` content. It is mitigated by tight scope (head injection plus script/link replacement only) and integration tests.
- **Vite 8 / Rolldown option names.** Some options, such as those for code splitting and dropping console calls, differ from Rollup/esbuild-era names. They must be verified against the installed Vite version during implementation.
