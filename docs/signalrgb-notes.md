# SignalRGB notes

Facts about how SignalRGB runs effects that affect how you write them, including some that are not in SignalRGB's documentation, and a list of what is still unverified.

Related: [Getting started](getting-started.md) · [Globals](globals.md) · [Build](build.md) · [SignalRGB Lightscripts documentation](https://docs.signalrgb.com/developer/lightscripts/)

## Renderers

SignalRGB renders effects with one of two engines, and the user chooses which:

- **UltraLight**, based on WebKit (as generally documented by that project).
- **QtWebEngine**, based on Chromium (as generally documented by that project).

Your effect has to work in both. They differ in supported web features and in frame timing (below). [`detectRenderer()`](runtime-api.md#detectrenderer) tells you which one is running your effect, based on the user agent.

## Frame rate

SignalRGB has an FPS setting, from 20 to 60. Effects are not known to receive it, and the two renderers handle it differently:

- **UltraLight**: `requestAnimationFrame` follows the setting. At 30 FPS, your frame callback runs about 30 times per second.
- **QtWebEngine**: `requestAnimationFrame` runs at 60 Hz whatever the setting, while SignalRGB samples frames at the setting's rate. At 30 FPS, your callback still runs about 60 times per second. This means some rendered frames are never sampled; that is an inference from the two rates, not a measurement.

So never assume a fixed frame rate. Scale motion by elapsed time, for example with the `dt` that [`createLoop()`](runtime-api.md#createloop) passes to your frame callback. Its `maxFps` option can lower the rate at which you render, but it cannot match SignalRGB's setting, because effects are not known to receive that setting.

## The visible area

SignalRGB shows only the top-left 320×200 pixels of the page and samples that area to drive device lighting.

- A canvas is optional. Plain DOM, CSS animations or SVG work too.
- Content may extend beyond 320×200; it just isn't shown. The plugin doesn't check the canvas size.
- The default 8px body margin shifts your content within the visible area, so set `body { margin: 0; }`.

## Clean console

SignalRGB's testing requirements ask for a clean console: an effect should log nothing besides SignalRGB's own "Loading Effect" message. The build removes `console.*` calls by default for this reason; see [`dropConsole`](build.md#dropconsole-and-minification). Uncaught errors also show up in the console, so make sure your effect doesn't throw inside SignalRGB.

## Pending verification on real SignalRGB

A probe effect will run inside SignalRGB with both renderers and record how it really behaves. It is not built yet, so these points are provisional. Where the toolkit depends on one of them, it keeps it behind a single option, helper or type, so it can change in one place once verified:

| Topic                         | Current assumption                                                                         | Where it matters                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Raw boolean shape             | `boolean` property globals are the strings `'0'` and `'1'` (`SRGBBoolean`).                | Use [`parseBoolean()`](runtime-api.md#parseboolean), which accepts every plausible form.                              |
| Renderer user agents          | UltraLight's user agent contains `Ultralight/`, QtWebEngine's contains `QtWebEngine/`.     | [`detectRenderer()`](runtime-api.md#detectrenderer) and [`RENDERER_SIGNATURES`](runtime-api.md#renderer_signatures).  |
| Build target                  | Both renderers run ES2020.                                                                 | The [`target`](build.md#target) option, default `'es2020'`; also whether [`script: 'module'`](build.md#module) works. |
| `freq` range                  | `engine.audio.freq` values are meaningful in 0–255.                                        | [`getFrequencies()`](runtime-api.md#getfrequencies) clamps to that range.                                             |
| Load-time handler calls       | Every `on<Prop>Changed` is called once at load; the order and timing are unknown.          | Don't rely on one handler running before another at load.                                                             |
| Raw `color` and `list` values | `color` globals are `#rrggbb` strings, and `list` globals are one of the `values` strings. | The generated types (`string` and the union of `values`).                                                             |
| Handler arguments             | `on<Prop>Changed` handlers receive no arguments.                                           | Read the property global inside the handler instead of relying on an argument.                                        |
| `onCanvasApiEvent` argument   | An object with `sender` and `event` strings, possibly with more fields.                    | The [`CanvasApiEvent`](runtime-api.md#canvasapievent) type declares only `sender` and `event`.                        |

Until then, test your effect in SignalRGB with both renderers before you share it.
