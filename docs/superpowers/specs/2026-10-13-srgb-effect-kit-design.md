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
| Source of truth | Effect manifest is passed as Vite plugin options in `vite.config.ts`. Plugin generates `<meta>` tags and a committed `.d.ts` declaring globals. |
| Ordering | `properties` and `meters` are **arrays** (order = UI order / declaration order), not objects. |
| Runtime philosophy | No wrappers over SignalRGB mechanics. Properties, `on<Prop>Changed`, `onCanvasApiEvent`, `engine` are used directly as globals; the toolkit only types them and provides standalone utilities. |
| Projects | One effect per Vite project. |
| Canvas | Optional. No validation of canvas presence or size. Content may extend beyond 320×200; SignalRGB shows only the top-left 320×200. |
| Testing against real SignalRGB | Windows VM running SignalRGB is the source of truth (probe effect). Daily dev happens in the browser with devtools. |
| Out of scope for v1 | CLI, deploy-to-folder, LED sampling preview, scaffolder (`create-srgb-effect`), native UltraLight/QtWebEngine runners, Playwright compat tests. |

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

- `on<Prop>Changed` globals are called by SignalRGB when a property changes. butterchurn-srgb depends on this.
- Users choose the renderer: **UltraLight** or **QtWebEngine**.
- SignalRGB has an FPS setting (20–60). Effects likely do not receive it.
  - UltraLight's rAF follows the setting.
  - QtWebEngine's rAF runs at 60 Hz while SignalRGB pulls frames at the setting's rate.
- SignalRGB displays only the top-left 320×200 of the page.

### 3.3 Unknown, to be determined by the probe (§9)

- Runtime raw types of `boolean`, `color` and `list` values.
- Whether `on<Prop>Changed` fires at load, and in what order.
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
| `srgb-effect-kit/client` | ambient types: `engine`, `onCanvasApiEvent`, `SRGBVision` | types only |

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
- `script?: 'classic' | 'module'`. Default `'classic'` (§8).
- `dropConsole?: boolean`. Default `true`.
- `target?: string | string[]`. Default `'es2020'`, provisional until the probe (§9).
- `devtools?: boolean | { fireChangedOnLoad?: boolean }`. Default `true`; applies in serve mode only. `fireChangedOnLoad` defaults to `false` until the probe shows SignalRGB fires handlers at load. A `false` default means an effect that relies on load-time firing fails visibly in dev rather than silently in SignalRGB.

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

On every `configResolved`, the plugin writes `typesFile`. It writes only when the content changed, to avoid watcher loops. The file is **committed**, so `tsc` on a fresh clone works without running Vite first.

```ts
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

These are standalone functions. Nothing here is required to use SignalRGB features.

| Area | API |
|---|---|
| Canvas | `getCanvas(opts?: { id?: string; context?: '2d' \| 'webgl' \| 'webgl2' })` → `{ canvas, ctx }`. Defaults: first `<canvas>`, 2D context. Throws a clear error if none is found. |
| Loop | `createLoop(frame: (info: { dt: number; time: number; frameCount: number }) => void, opts?: { maxFps?: number })` → `{ start(), stop(), setMaxFps(n), running }`. Built on rAF; the FPS cap uses time accumulation (no lodash). `dt` is in seconds. |
| Renderer | `detectRenderer(): 'ultralight' \| 'qtwebengine' \| 'browser'`, `isSignalRGB(): boolean`. Based on the UA, using signatures recorded by the probe. |
| Audio | `isSilent()`, using the level check and spectrum-sum threshold proven in butterchurn-srgb. `getFrequencies(): number[]` returns 200 sanitized values; garbage and non-finite entries become 0, and final range semantics come from the probe. |
| Screen zones | `getZone(x: 0–27, y: 0–19)` → `{ h, s, l }`. `getZones()` → 560 `{ h, s, l }` in row-major order. |
| Meters | `createMeter(size, callback)` → `{ value, diff, increased, decreased, setValue(v) }`. A typed port of the docs' `Meter` class: the callback fires only after `size` identical consecutive values that differ from the current value. |
| Color | `hexToRgb`, `rgbToHex`, `rgbToHsl`, `hslToRgb`, `hexToHsl`, `hslToHex`, `hsl(h, s, l, a?)`, `rgb(r, g, b, a?)`, `lerpColor(a, b, t)`. |
| Booleans | `parseBoolean(v: SRGBBoolean \| boolean \| number): boolean`. Tolerates every plausible raw form until the probe settles the real one. |

`srgb-effect-kit/client` declares:

```ts
declare global {
  var engine: SRGBEngine;   // { audio: SRGBEngineAudio; zone: SRGBEngineZone; vision: SRGBVision }
  var onCanvasApiEvent: ((event: { sender: string; event: string }) => void) | undefined;
  interface SRGBVision {}   // augmented by generated types
  type SRGBBoolean = '0' | '1'; // provisional (matches butterchurn-srgb usage); finalized by probe
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
   - By default (`script: 'classic'`), it wraps the bundle in an IIFE and emits a classic `<script>` at the end of `<body>`.
     - The IIFE keeps top-level declarations from leaking into global scope and colliding with property globals.
     - It errors if the output contains `import.meta` (other than Vite-replaced `import.meta.env`), top-level `await`, `import` or `export`.
   - With `script: 'module'`, it emits an inline `<script type="module">`.
4. Prepends the §6 prelude to the bundle.
5. **Final string pass:** injects the §5.3 head markup. String operations are required because of the non-void meter `<meta>` elements; an HTML parser would mangle them.

It then logs the output size.

### 8.2 Other build settings

- `build.target` comes from the `target` option (provisional `es2020`).
- `dropConsole` maps to the bundler's console/debugger drop option, to meet the clean-console requirement.
- The standard doctype is kept by default. The probe verifies both the doctype and the no-doctype variant.

## 9. Probe effect (`examples/probe`)

A diagnostic effect built with the toolkit itself. It is loaded in SignalRGB inside the Windows VM, once per renderer, and at several FPS settings. It declares one property of every control type and one meter of every type.

### 9.1 What it records

- **Environment:**
  - `navigator.userAgent`
  - `innerWidth`/`innerHeight`, `devicePixelRatio`
  - A diff of global names against a clean-browser baseline that ships with the probe, to find undocumented injected globals.
- **Properties:**
  - `typeof` and raw value per control type.
  - Whether and in what order `on<Prop>Changed` fires at load.
  - Firing on each change, including per keystroke for `textfield`.
- **Engine:**
  - Deep shape of `engine`: keys, types, Array vs typed array, lengths.
  - Rolling min/max for `audio.level`, `audio.width`, `audio.density` and `audio.freq`, including negative and garbage values.
  - `zone` arrays.
  - `vision.<meter>`, and whether bare meter globals exist.
- **Timing:** measured rAF rate, the rAF timestamp argument, and the reported SignalRGB FPS setting (entered manually via a property).
- **Features:**
  - ES syntax level checks (via `new Function` probes).
  - `type="module"` execution, as a separate variant build.
  - WebGL1/2, OffscreenCanvas, Worker, AudioContext.
  - `fetch` to the dev server.
  - localStorage persistence across reloads.
- **`onCanvasApiEvent`:** the full argument object, triggered by `curl -X POST "http://localhost:16034/canvas/event?sender=probe&event=test"` inside the VM.

### 9.2 How it reports

1. A paged on-screen report within 320×200; a `list` property selects the page.
2. A JSON dump to the console (SignalRGB console panel).
3. If a `textfield` property holds the dev server URL, a `POST` to `/__srgb-effect/probe` on the Vite dev server. The server saves the result to `probe-results/<renderer>-<ISO date>.json`. The VM reaches the host through its NAT gateway IP.

### 9.3 Where findings go

Findings are recorded in `docs/probe-findings.md` and feed into:

- `detectRenderer` signatures
- the default `target` and `script`
- raw types in the generated `.d.ts`
- devtools defaults: load-time firing, renderer UA strings, viewport

## 10. Devtools (serve mode only)

### 10.1 Injection and bootstrap

In serve mode, `transformIndexHtml` does the following:

- Injects the §5.3 head markup, for parity with the build.
- Injects the devtools module script **before** the user's scripts. Module scripts execute in document order, so the devtools bootstrap runs first.
- Passes the manifest as a virtual module, `virtual:srgb-effect/manifest`.

The bootstrap, synchronously at module top level:

- Sets every property global from localStorage or the default, in SignalRGB raw format.
- Defines the `on<Prop>Changed` prelude.
- Installs the `engine` mock (`audio`, `zone`, `vision`).
- After user code has run, fires every `on<Prop>Changed` in property order, only if `fireChangedOnLoad` is set (§5.1).

localStorage keys are namespaced by effect title (`srgb-effect-kit:<title>:…`), because all projects share the `localhost:5173` origin.

Devtools are never present in build output.

### 10.2 Page rendering

- The effect page renders as-is, at full size. No iframe.
- **Visible-area marker:** a fixed overlay with `pointer-events: none`.
  - Red lines are drawn along x=320 and y=200, just outside the visible area, so no visible pixel is covered.
  - Optional dimming outside the 320×200 region.
  - Toggleable.

### 10.3 Drawer UI

The drawer follows the style of TanStack Query/Router devtools.

- It lives in a Shadow DOM root with `position: fixed` and a high z-index, so it is isolated from the effect's CSS and does not affect the effect's layout.
- It is collapsed by default to a small toggle button in the bottom-right corner.
- When open, it docks bottom or right and is resizable. Open state, dock side and size are persisted.
- It is written in vanilla TypeScript and CSS, with no UI framework dependency.

### 10.4 Tabs

| Tab | Behaviour |
|---|---|
| Properties | One control per type: number → slider plus value; hue → slider with hue-gradient track; boolean → toggle; color → color input; textfield → text input firing per keystroke; list → `<select>`. A change sets the global in raw format and calls `window.on<Prop>Changed?.()`. Includes reset-to-defaults. |
| Audio | Modes: silent / random / microphone / system capture (`getDisplayMedia` audio). Each frame writes `engine.audio.{level, width, density, freq[200]}`. Ported from butterchurn-srgb, with `width` added. |
| Screen | Source: solid color / gradient / screen capture (`getDisplayMedia` video). The source is downsampled to a 28×20 grid, which writes the `engine.zone` HSL arrays. |
| Meters | For each meter, a manual value control: `linear`/`area` 0–1, `ocr_textmatch` −1/0/1, `ocr_numeric` integer. When screen capture is active, `linear` and `area` values are computed from captured pixels using the meter's region and HSL ranges, with a region overlay on the capture preview. OCR meters stay manual. Values are written to `engine.vision.<name>`. |
| Canvas API | A sender/event form that calls `window.onCanvasApiEvent?.({ sender, event })`. The dev server also exposes `POST /canvas/event?sender=…&event=…`, matching SignalRGB's endpoint shape. Requests are relayed over Vite's WebSocket (`server.ws.send` → `import.meta.hot.on`), so real game or app integrations can target the dev server by changing the port. |
| Renderer | Simulates `browser` / `ultralight` / `qtwebengine` together with an SRGB FPS setting (20–60). The simulation overrides `navigator.userAgent` using the probe-recorded UA strings (placeholder strings until the probe runs), so `detectRenderer()` needs no dev hook. UltraLight simulation throttles `requestAnimationFrame` to the FPS setting; QtWebEngine simulation leaves rAF at native rate. |
| SignalRGB view | A scaled-up, pixelated live copy of the visible 320×200, sampled at the simulated FPS. If a canvas covers the region, it is sampled directly. Otherwise it uses opt-in tab capture (`getDisplayMedia` with `preferCurrentTab`), cropped to the region. |
| Console | Counts `console.log`/`warn`/`error` calls from effect code and shows a warning badge (the clean-console requirement). |

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
- **`devtools/`:** jsdom tests covering bootstrap ordering, global setting, raw-format conversion, persistence namespacing and the canvas-event relay. The UI is verified manually through the examples.
- **CI:** build all examples as an end-to-end smoke test.

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
- Native UltraLight/QtWebEngine runners and Playwright compat tests.
- Keypress/"tap effect" APIs. These are undocumented; add them if the probe discovers them.

## 14. Risks

- **Probe-dependent defaults.** Raw types, target, script format and load-time firing are provisional until the probe runs. The design isolates each of them behind one option or one table, so updating them is local.
- **VM fidelity.** Without GPU passthrough, QtWebEngine may fall back to software rendering, which could affect WebGL and timing results. Findings must be labelled with the VM context, and spot-checked on bare metal (dual-boot) when results look suspicious.
- **String-based HTML post-processing.** This is fragile against unusual `index.html` content. It is mitigated by tight scope (head injection plus script/link replacement only) and integration tests.
- **Vite 8 / Rolldown option names.** Some options, such as those for code splitting and dropping console calls, differ from Rollup/esbuild-era names. They must be verified against the installed Vite version during implementation.
