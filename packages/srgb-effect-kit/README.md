# srgb-effect-kit

Build [SignalRGB](https://signalrgb.com/) effects (Lightscripts) with Vite and TypeScript.

- Declare the effect's metadata, controls and screen meters once, in `vite.config.ts`.
- Get typed globals for every property and `on<Property>Changed` handler.
- `vite build` produces one self-contained HTML file to drop into SignalRGB.

## Setup

```sh
pnpm add -D srgb-effect-kit vite typescript
```

```ts
// vite.config.ts
import { srgbEffect } from 'srgb-effect-kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    srgbEffect({
      title: 'My Effect',
      description: 'What it does',
      publisher: 'you',
      properties: [
        { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
        {
          property: 'mode',
          type: 'list',
          label: 'Mode',
          values: ['Wave', 'Pulse'],
          default: 'Wave',
        },
      ],
    }),
  ],
});
```

`index.html` contains only your body: a canvas, other DOM, or nothing at all. Do not write `<title>` or SignalRGB `<meta>` tags; the plugin generates them.

## Globals

SignalRGB injects each property as a global and calls `on<Property>Changed` once at load and whenever the user changes the value.

The plugin writes `src/srgb-effect.d.ts`, which types all of these. Commit it.

```ts
let current = speed;
window.onSpeedChanged = () => {
  current = speed; // speed: number
};
```

The generated file references `srgb-effect-kit/client`, which brings SignalRGB's own globals into scope. They are typed once, in the runtime's globals module, so there are no wrappers to learn: use them directly.

```ts
const level = engine.audio.level; // or window.engine.audio.level
const ctx = document.querySelector('canvas')!.getContext('2d')!;
window.onCanvasApiEvent = ({ sender, event }) => {};
```

`engine` is typed as `SRGBEngine` (`audio`, `zone`, and `vision`, whose `SRGBVision` interface gains one key per meter). It only exists inside SignalRGB, so guard it (`globalThis.engine?.audio`) in code that also runs in a plain browser. The `SRGBEngine`, `EngineAudio`, `EngineZone`, `CanvasApiEvent` and `SRGBBoolean` types are also exported from `srgb-effect-kit`.

Keep `src/srgb-effect.d.ts` inside your tsconfig `include`. `typesFile` is relative to the Vite root.

Boolean properties arrive as raw `SRGBBoolean` (`'0' | '1'`, provisional until verified on real SignalRGB). Use `parseBoolean()` for them.

**Do not declare `function onSpeedChanged() {}` or `const onSpeedChanged = …` at the top of a module.** Module code is not global, so SignalRGB never calls it. The plugin warns when it finds one. Assign to `window` instead; bare assignment (`onSpeedChanged = …`) works too.

## Devtools

A dev-only in-browser devtools drawer is coming. It will cover property controls, audio/screen/meter mocks, canvas API events, renderer/FPS simulation and the visible 320×200 area marker. `srgbEffect({ devtools })` already accepts `true | false | { fireChangedOnLoad?: boolean }`.

## Options

| Option                              | Default                     | Description                                                                                           |
| ----------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `title`, `description`, `publisher` |                             | Effect metadata                                                                                       |
| `properties`                        | `[]`                        | Controls, in UI order: `number`, `hue`, `boolean`, `color`, `textfield`, `list`                       |
| `meters`                            | `[]`                        | Screen meters: `linear`, `area`, `ocr_textmatch`, `ocr_numeric`, with `resolutions`, `hdr` and `tags` |
| `typesFile`                         | `src/srgb-effect.d.ts`      | Generated typings path                                                                                |
| `fileName`                          | kebab-cased title + `.html` | Build output name                                                                                     |
| `script`                            | `'classic'`                 | `'classic'` emits an IIFE in `<script>`; `'module'` emits `<script type="module">`                    |
| `dropConsole`                       | `true`                      | Removes `console.*`. SignalRGB requires a clean console.                                              |
| `target`                            | `'es2020'`                  | Build target                                                                                          |

In the default classic mode, the build fails with an `[srgb-effect]` message on external imports (for example CDN URLs) and on top-level `await`. Set `script: 'module'` if you need either.

## Utilities

```ts
import {
  createLoop,
  hsl,
  isSilent,
  getFrequencies,
  getZone,
  createMeter,
  detectRenderer,
} from 'srgb-effect-kit';
```

| Area     | Exports                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------- |
| Loop     | `createLoop(frame, { maxFps? })`, where `frame` receives `{ dt, time, frameCount }`                     |
| Renderer | `detectRenderer()` returns `'ultralight' \| 'qtwebengine' \| 'browser'`; also `isSignalRGB()`           |
| Audio    | `isSilent()`, `getFrequencies()`, reading `engine.audio` unless you pass one                            |
| Screen   | `getZone(x, y)` and `getZones()` over the 28×20 grid of `engine.zone`                                   |
| Meters   | `createMeter(size, callback)`, which debounces `engine.vision.<meter>` readings                         |
| Color    | `hexToRgb`, `rgbToHex`, `rgbToHsl`, `hslToRgb`, `hexToHsl`, `hslToHex`, `hsl()`, `rgb()`, `lerpColor()` |
| Booleans | `parseBoolean()`                                                                                        |

`createLoop`'s `time` is rendered time: spans while the loop is paused are excluded. An invalid `maxFps` (non-finite or ≤ 0) disables the cap.

## Renderers and frame rate

SignalRGB renders effects with either UltraLight or QtWebEngine, chosen by the user.

SignalRGB's FPS setting (20–60) is not exposed to effects:

- UltraLight's `requestAnimationFrame` follows the setting.
- QtWebEngine runs at 60 Hz while SignalRGB samples frames at the setting's rate.

Only the top-left 320×200 of the page is shown.
