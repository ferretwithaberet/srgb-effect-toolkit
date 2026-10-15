# Devtools

In `pnpm dev`, `srgbEffect()` turns the browser into a stand-in for SignalRGB. Your effect's globals exist and behave as they do in SignalRGB, and a drawer lets you drive them. The devtools are never part of `pnpm build`.

Related: [Globals](globals.md) · [Configuration](configuration.md#options) · [SignalRGB notes](signalrgb-notes.md)

## Modes

The `devtools` option picks how much of SignalRGB `pnpm dev` simulates:

| Mode               | What you get in `pnpm dev`                                                                                                                                                                                                                                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `'full'` (default) | SignalRGB's environment plus the drawer and the visible-area marker. Everything on this page.                                                                                                                                                                     |
| `'minimal'`        | SignalRGB's environment only: handler globals, property globals at their **defaults**, a silent `engine` mock, the load-time handler calls and `POST /canvas/event`. Nothing is shown, stored or simulated beyond that, and the drawer's code is not even loaded. |
| `'none'`           | Nothing. The page is served as is, so effect code that reads SignalRGB's globals throws a `ReferenceError`.                                                                                                                                                       |

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

   | Type                | Raw value      |
   | ------------------- | -------------- |
   | `number`, `hue`     | number         |
   | `boolean`           | `'0'` or `'1'` |
   | `color`             | `#rrggbb`      |
   | `textfield`, `list` | string         |

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
- Dragging its inner edge resizes it, between 160 px and 90% of the window. Size changes are applied once per frame while you drag, and saved when you let go.
- Switching the dock or resizing the window clamps the size on screen but keeps the size you chose, so it comes back when there is room again.
- The open state, dock side, size, selected tab and area toggles survive reloads.

The drawer lives in its own Shadow DOM on `<html>`, outside `<body>`. Your CSS cannot reach it, and it does not change your layout or catch clicks outside its own controls. A badge on the SRGB button counts console output; see [Console](#console).

## Tabs

A tab is created the first time you select it. Tabs that do periodic work, such as the view and the frame-rate meter, run only while they are shown.

### Properties

There is one control per property, in the order you declared them:

| Type        | Control                                |
| ----------- | -------------------------------------- |
| `number`    | slider with its value                  |
| `hue`       | slider on a hue gradient               |
| `boolean`   | checkbox                               |
| `color`     | color picker                           |
| `textfield` | text input, updated on every keystroke |
| `list`      | dropdown                               |

A change sets the global, then calls `window.on<Property>Changed()` with no arguments, as SignalRGB does. Setting the value the global already has calls nothing. **Reset to defaults** restores every default and calls the handlers of the properties that changed.

Values persist across reloads. A stored value that no longer fits the config falls back to the default; examples are a list value you removed, or a renamed property. Numbers are rounded to whole numbers, and numbers outside a changed `min`/`max` are clamped instead.

### Audio

Writes `engine.audio` on every native animation frame:

| Mode         | Behaviour                                                                                                             |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Silent       | `level` -100 and everything else 0. [`isSilent()`](runtime-api.md#issilent) is `true`.                                |
| Random       | Noisy but plausible values: `level` from -60 to 0 dB, and 200 bands from 0 to 255 that fall off towards the high end. |
| Microphone   | Analyses your microphone.                                                                                             |
| System audio | Analyses a tab or screen you share. Tick **Share audio** in the browser's picker.                                     |

From live audio:

- `level` is the loudness in dB;
- `width` is the stereo width (0 for mono);
- `density` is the spectral flatness (near 0 for a pure tone, near 1 for noise);
- `freq` holds the first 200 bands of a 512-point FFT, each 0–255.

A capture mode is never restored after a reload, because it needs a click: choosing Microphone or System audio stores Silent. Only Silent and Random come back.

A capture that fails falls back to Silent and shows the reason as text in the tab. That covers a denied permission, no audio shared (**Share audio** unticked), and an error while reading the audio. When you stop sharing, the tab also goes back to Silent and shows `Audio capture ended.`.

### Screen

Writes `engine.zone`, the 28×20 grid:

| Source         | Behaviour                                                                                       |
| -------------- | ----------------------------------------------------------------------------------------------- |
| Solid color    | Fills the grid with one color.                                                                  |
| Gradient       | Fills the grid with a left-to-right gradient.                                                   |
| Screen capture | Shares a screen, window or tab. The capture is sampled 10 times a second and averaged per cell. |

The preview shows the grid. During a capture, it shows the captured frame with each `linear` and `area` meter's region outlined. Zone values use hue 0–360 and saturation and lightness 0–100. That scale is not verified on SignalRGB yet.

Like audio, a capture is never restored after a reload; only Solid color and Gradient are. When a capture fails (permission denied, no video shared, a read error) the tab goes back to the previous Solid color or Gradient, or to black, and shows the reason as text. When you stop the share, it goes back the same way and shows `Screen capture ended.`. A browser that exposes no `navigator.mediaDevices`, such as a page opened over plain `http` from another machine on your network, reports `[srgb-effect] screen capture needs a secure context (https or localhost)`.

### Meters

There is one control per meter, and its value goes to `engine.vision.<meter>`:

- `linear` and `area`: a 0–1 slider.
- `ocr_textmatch`: 1, 0 or -1.
- `ocr_numeric`: a whole number, -1 for "nothing read".

In the number field, a half-typed value such as `-` stays as you typed it, and nothing is written until it is a number. The value is committed when the field changes, for example when you leave it.

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

The tab lists the latest 20 events from both sources, and flags those that arrived while no `onCanvasApiEvent` was assigned.

### Renderer

Simulates the renderer SignalRGB uses, together with its FPS setting (20–60):

| Renderer    | User agent               | requestAnimationFrame                                |
| ----------- | ------------------------ | ---------------------------------------------------- |
| Browser     | yours                    | native                                               |
| UltraLight  | an UltraLight user agent | throttled to the FPS setting                         |
| QtWebEngine | a QtWebEngine user agent | native (SignalRGB samples frames at the FPS setting) |

[`detectRenderer()`](runtime-api.md#detectrenderer) and `isSignalRGB()` follow the simulation without any code change. Changing the renderer reloads the page, so your code starts under it. The FPS setting applies at once. The tab measures the requestAnimationFrame rate your loop actually gets.

The simulated user agents are placeholders until the probe effect verifies them on SignalRGB (Plan 3). The simulation covers the user agent and frame timing only; it does not reproduce each renderer's web feature support.

### SignalRGB view

A live, pixelated 2× copy of the visible 320×200, redrawn at the FPS setting:

- If a canvas covers the area, it is sampled directly. A WebGL canvas must be created with `preserveDrawingBuffer: true` for this to work; without it the view may stay blank.
- Otherwise, **Capture this tab** shares the current tab and crops it. The capture is opt-in, is never restored after a reload, and stops when you leave the tab or close the drawer. In a browser that exposes no `navigator.mediaDevices`, it reports `[srgb-effect] tab capture needs a secure context (https or localhost)`.

The view samples on the browser's own frame timing, so UltraLight's throttle does not slow it down.

### Console

SignalRGB expects a clean console. This tab counts `console.log`, `info`, `warn`, `error` and `debug` calls, plus uncaught errors and unhandled promise rejections, since the page loaded. Vite's own messages are not counted. **Reset** zeroes the counts. The same total appears as a badge on the SRGB button (`99+` above 99); both update at most once per frame.

The build removes `console.*` calls by default ([`dropConsole`](build.md#dropconsole-and-minification)), but uncaught errors still reach SignalRGB's console.

## Stored settings

Settings live in `localStorage` under `srgb-effect-kit:<title>:<key>`. Every effect served from `localhost:5173` shares one origin, so the key includes the effect's title, which keeps effects apart. Changing the title starts from defaults.

The keys are:

| Key          | Holds                     |
| ------------ | ------------------------- |
| `properties` | property values           |
| `drawer`     | drawer state              |
| `audio`      | audio mode                |
| `screen`     | screen source             |
| `meters`     | manual meter values       |
| `renderer`   | renderer and FPS          |
| `canvas-api` | the last sender and event |

**Reset to defaults** in the Properties tab restores the properties. To clear every setting, clear the site's data in the browser.

## Limits

- **Classic scripts:** an inline classic `<script>` in `index.html` runs while the page parses, before any module script, so it does not see the globals. Keep effect code in module scripts, as Vite does by default.
- **Load-time calls:** these run on `DOMContentLoaded`. Handlers assigned later, for example after a top-level `await`, miss them.
- **Capture:** screen, tab and audio capture need a click and the browser's permission each time.
