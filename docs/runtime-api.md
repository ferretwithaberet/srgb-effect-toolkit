# Runtime API

Reference for every export of `srgb-effect-kit`, the runtime entry point you import in effect code. Everything here is optional: SignalRGB's own features are plain [globals](globals.md). These helpers cover the parts that take real work to get right, such as frame timing, noisy audio data and debounced meters.

```ts
import { createLoop, hsl, isSilent } from 'srgb-effect-kit';
```

The package is ESM-only, and its helpers are tree-shaken: the build includes only what you import. The Vite plugin lives in a separate entry point, `srgb-effect-kit/vite`; see [Configuration](configuration.md).

Contents: [Loop](#loop) · [Color](#color) · [Audio](#audio) · [Screen zones](#screen-zones) · [Meters](#meters) · [Renderer](#renderer) · [Booleans](#booleans) · [Types](#types)

## Loop

### `createLoop`

```ts
function createLoop(frame: (info: LoopInfo) => void, options?: LoopOptions): Loop;
```

Creates a `requestAnimationFrame` loop that calls `frame` once per rendered frame.

- `frame` receives a [`LoopInfo`](#loopinfo) with `dt`, `time` and `frameCount`.
- `options.maxFps` caps the rendered frame rate. Leave it unset to render on every display refresh.
- Returns a [`Loop`](#loop-1). The loop is created stopped; call `start()`.

```ts
import { createLoop } from 'srgb-effect-kit';

const ctx = document.querySelector('canvas')!.getContext('2d')!;
let x = 0;

const loop = createLoop(
  ({ dt }) => {
    x = (x + 100 * dt) % 320; // 100 pixels per second, whatever the frame rate
    ctx.clearRect(0, 0, 320, 200);
    ctx.fillRect(x, 90, 20, 20);
  },
  { maxFps: 30 },
);
loop.start();
```

Behaviour:

- **Timing.** `dt` and `time` are in seconds and rounded to microseconds, so float noise does not accumulate. Multiply speeds by `dt` to keep motion independent of the frame rate.
- **Stopping and restarting.** `stop()` cancels the pending frame. After `start()`, the first `dt` is 0, so the pause does not show up as one huge step. `time` excludes paused spans, and `frameCount` continues from where it stopped. `start()` does nothing while the loop is already running.
- **Frame-rate cap.** The cap works by skipping display refreshes, so it can lower the frame rate but never raise it above the refresh rate. It keeps a steady cadence: at 60 Hz with `maxFps: 30`, every other refresh renders. A refresh that arrives up to 1 ms early still counts, to absorb timestamp jitter. `dt` is the real time since the previous rendered frame.
- **Invalid caps.** A `maxFps` that is not a finite number above 0 (for example `0`, a negative number or `NaN`) disables the cap instead of throwing.
- **Errors.** The next frame is requested before `frame` runs, so the loop keeps running if `frame` throws.

On SignalRGB, how often frames are rendered depends on the renderer and the user's FPS setting, which effects cannot read. See [SignalRGB notes](signalrgb-notes.md#frame-rate).

### `Loop`

```ts
interface Loop {
  start(): void;
  stop(): void;
  setMaxFps(maxFps: number | undefined): void;
  readonly running: boolean;
}
```

- `start()`: starts requesting frames. Does nothing if already running.
- `stop()`: stops requesting frames.
- `setMaxFps(maxFps)`: changes the cap, also while running. `undefined` or an invalid value removes it.
- `running`: whether the loop is running.

### `LoopInfo`

```ts
interface LoopInfo {
  dt: number;
  time: number;
  frameCount: number;
}
```

- `dt`: seconds since the previous rendered frame; 0 on the first frame after `start()`.
- `time`: seconds of rendered time since the first frame, excluding paused spans.
- `frameCount`: 1-based count of rendered frames.

For refreshes at 1000, 1016 and 1050 ms, `frame` receives `{ dt: 0, time: 0, frameCount: 1 }`, `{ dt: 0.016, time: 0.016, frameCount: 2 }`, then `{ dt: 0.034, time: 0.05, frameCount: 3 }`.

### `LoopOptions`

```ts
interface LoopOptions {
  maxFps?: number;
}
```

- `maxFps`: upper bound on rendered frames per second. Non-finite or non-positive values disable the cap.

## Color

Conversions between hex strings, RGB and HSL, plus CSS string builders. RGB channels are 0–255; HSL hue is 0–360 degrees, saturation and lightness 0–100 percent.

### `hexToRgb`

```ts
function hexToRgb(hex: string): Rgb;
```

Parses a 6-digit (`#009bde`) or 3-digit (`#fff`) hex color, in any case, with or without the `#`. Throws `Error: [srgb-effect] invalid hex color "<hex>"` for anything else, including CSS color names.

```ts
hexToRgb('#009bde'); // { r: 0, g: 155, b: 222 }
hexToRgb('#FFF'); // { r: 255, g: 255, b: 255 }
hexToRgb('00ff00'); // { r: 0, g: 255, b: 0 }
```

### `rgbToHex`

```ts
const rgbToHex: ({ r, g, b }: Rgb) => string;
```

Formats lowercase `#rrggbb`. Each channel is clamped to 0–255 and rounded.

```ts
rgbToHex({ r: 0, g: 155, b: 222 }); // '#009bde'
rgbToHex({ r: 300, g: -5, b: 127.6 }); // '#ff0080'
```

### `rgbToHsl`

```ts
function rgbToHsl({ r, g, b }: Rgb): Hsl;
```

Converts RGB to HSL, rounding each component to one decimal. Greys have `h: 0` and `s: 0`.

```ts
rgbToHsl({ r: 255, g: 0, b: 0 }); // { h: 0, s: 100, l: 50 }
rgbToHsl({ r: 128, g: 128, b: 128 }); // { h: 0, s: 0, l: 50.2 }
```

### `hslToRgb`

```ts
function hslToRgb({ h, s, l }: Hsl): Rgb;
```

Converts HSL to RGB with integer channels. The hue wraps around, so `480` and `-240` both mean `120`. Saturation and lightness are clamped to 0–100.

```ts
hslToRgb({ h: 120, s: 100, l: 50 }); // { r: 0, g: 255, b: 0 }
```

### `hexToHsl`

```ts
const hexToHsl: (hex: string) => Hsl;
```

`rgbToHsl(hexToRgb(hex))`. Useful for `color` properties, which arrive as hex strings. Throws on invalid hex like `hexToRgb`.

```ts
const { h, s, l } = hexToHsl(tint);
```

### `hslToHex`

```ts
const hslToHex: (value: Hsl) => string;
```

`rgbToHex(hslToRgb(value))`. `hslToHex(hexToHsl('#009bde'))` round-trips to `'#009bde'`.

### `hsl`

```ts
const hsl: (h: number, s: number, l: number, a?: number) => string;
```

Builds a CSS color string for `fillStyle` and similar. With `a`, it returns `hsla()`. It uses the comma syntax, which older engines understand, and does not clamp or round.

```ts
hsl(200, 100, 50); // 'hsl(200, 100%, 50%)'
hsl(200, 100, 50, 0.5); // 'hsla(200, 100%, 50%, 0.5)'
```

### `rgb`

```ts
const rgb: (r: number, g: number, b: number, a?: number) => string;
```

Like `hsl`, for RGB. With `a`, it returns `rgba()`.

```ts
rgb(1, 2, 3); // 'rgb(1, 2, 3)'
rgb(1, 2, 3, 0); // 'rgba(1, 2, 3, 0)'
```

### `lerpColor`

```ts
function lerpColor(from: string, to: string, t: number): string;
```

Interpolates between two hex colors in RGB space and returns lowercase `#rrggbb`. `t` is clamped to 0–1, so `0` returns `from` and `1` (or more) returns `to`. Throws on invalid hex like `hexToRgb`.

```ts
lerpColor('#000000', '#ffffff', 0.5); // '#808080'
lerpColor('#ff0000', '#0000ff', 2); // '#0000ff'
```

### `Rgb` and `Hsl`

```ts
interface Rgb {
  r: number; // 0–255
  g: number; // 0–255
  b: number; // 0–255
}

interface Hsl {
  h: number; // 0–360
  s: number; // 0–100
  l: number; // 0–100
}
```

## Audio

Helpers for [`engine.audio`](globals.md#engineaudio). Both take an optional audio object and default to `engine.audio`. Outside SignalRGB, where `engine` is undefined, they report silence instead of throwing.

### `isSilent`

```ts
function isSilent(audio?: Partial<EngineAudio> | undefined): boolean;
```

Whether no audio is playing. SignalRGB leaks a low noise floor into `freq` while nothing plays, so a plain "all zeros" check does not work. `isSilent` returns `true` when any of these holds:

- there is no audio data (for example, outside SignalRGB);
- `level` is -100 dB or lower;
- `freq` is missing or empty;
- the positive values of `freq` sum to less than [`SILENCE_SUM_THRESHOLD`](#silence_sum_threshold) (50). Negative values are ignored.

```ts
import { createLoop, isSilent } from 'srgb-effect-kit';

createLoop(() => {
  if (isSilent()) return; // keep the last frame while nothing plays
  // draw the visualizer
}).start();
```

### `getFrequencies`

```ts
function getFrequencies(audio?: Partial<EngineAudio> | undefined): number[];
```

Returns a new array of [`FREQUENCY_BINS`](#frequency_bins) (200) sanitized bands from `engine.audio.freq`:

- non-finite values (`NaN`, `Infinity`) and negative values become 0;
- values above 255 are clamped to 255;
- missing bands, or all bands when there is no audio data, are 0.

The 0–255 range is provisional until it is verified on real SignalRGB.

```ts
getFrequencies({ freq: [10, -5, Number.NaN, 300, Infinity, 255.4] }).slice(0, 6);
// [10, 0, 0, 255, 0, 255]
```

### `FREQUENCY_BINS`

```ts
const FREQUENCY_BINS = 200;
```

Number of bands in `engine.audio.freq` and in `getFrequencies()`'s result.

### `SILENCE_SUM_THRESHOLD`

```ts
const SILENCE_SUM_THRESHOLD = 50;
```

`isSilent()` treats a spectrum whose positive values sum to less than this as silence.

## Screen zones

Helpers for [`engine.zone`](globals.md#enginezone), the 28×20 grid of screen colors. Both take an optional zone object and default to `engine.zone`. Missing data reads as 0, so outside SignalRGB every cell is `{ h: 0, s: 0, l: 0 }`.

### `getZone`

```ts
function getZone(x: number, y: number, zone?: Partial<EngineZone> | undefined): ZoneColor;
```

Returns the color of the cell at column `x` (0–27) and row `y` (0–19), with the origin at the top-left. Throws `RangeError: [srgb-effect] getZone: (<x>, <y>) is outside the 28×20 grid` when either coordinate is not an integer inside the grid, including fractions such as `1.5`.

```ts
import { getZone, hsl } from 'srgb-effect-kit';

const center = getZone(14, 10);
const fill = hsl(center.h, center.s, center.l);
```

### `getZones`

```ts
function getZones(zone?: Partial<EngineZone> | undefined): ZoneColor[];
```

Returns all 560 cells in row-major order: the cell at `(x, y)` is at index `y * 28 + x`.

```ts
import { ZONE_COLUMNS, getZones } from 'srgb-effect-kit';

const zones = getZones();
const topRight = zones[ZONE_COLUMNS - 1];
```

### `ZONE_COLUMNS` and `ZONE_ROWS`

```ts
const ZONE_COLUMNS = 28;
const ZONE_ROWS = 20;
```

### `ZoneColor`

```ts
interface ZoneColor {
  h: number;
  s: number;
  l: number;
}
```

One cell, read from `engine.zone.hue`, `saturation` and `lightness` at the same index.

## Meters

### `createMeter`

```ts
function createMeter(size: number, callback: (meter: Meter) => void): Meter;
```

Debounces a [screen meter](configuration.md#meters). Meter readings flicker, for example when an effect or a menu briefly covers a health bar. This is a typed port of the Meter class from SignalRGB's documentation.

Feed it one reading per frame with `setValue()`. It accepts a new value only after `size` identical consecutive readings that differ from the current value, then updates its state and calls `callback` with itself.

- The initial value is 0, so a stable reading of 0 at startup never fires the callback.
- Readings that keep changing, such as 0.5, 0.6, 0.5, 0.6, never fire it.
- Once a value is accepted, more identical readings do not fire again.
- With `size: 1`, every change fires.
- `size` must be a positive integer, or `createMeter` throws `Error: [srgb-effect] createMeter: size must be a positive integer`.

```ts
import { createLoop, createMeter } from 'srgb-effect-kit';

let flash = 0;
const health = createMeter(3, (meter) => {
  if (meter.decreased && meter.diff > 0.1) flash = 1; // lost more than 10% health
});

createLoop(({ dt }) => {
  health.setValue(engine.vision.health);
  flash = Math.max(0, flash - dt);
}).start();
```

This assumes a meter named `health` in your config, so the generated types declare `engine.vision.health`.

### `Meter`

```ts
interface Meter {
  readonly value: number;
  readonly diff: number;
  readonly increased: boolean;
  readonly decreased: boolean;
  setValue(value: number): void;
}
```

- `value`: the last accepted value. Starts at 0.
- `diff`: absolute change of the last accepted update.
- `increased`, `decreased`: the direction of the last accepted update.
- `setValue(value)`: feeds one reading.

## Renderer

SignalRGB renders effects with UltraLight or QtWebEngine, chosen by the user. See [SignalRGB notes](signalrgb-notes.md#renderers).

### `detectRenderer`

```ts
const detectRenderer: (userAgent?: string) => Renderer;
```

Identifies the renderer from a user agent string, by default `navigator.userAgent` (or `''` when there is no `navigator`). Returns `'ultralight'` or `'qtwebengine'` when a [signature](#renderer_signatures) matches, otherwise `'browser'`, as in `vite dev`.

```ts
import { detectRenderer } from 'srgb-effect-kit';

detectRenderer(); // 'browser' in vite dev
detectRenderer('Mozilla/5.0 … Ultralight/1.4.0 Version/16.4.1 Safari/615.1.18.100.1'); // 'ultralight'
```

### `isSignalRGB`

```ts
const isSignalRGB: (userAgent?: string) => boolean;
```

`true` when `detectRenderer(userAgent)` is not `'browser'`. For example, outline the area SignalRGB shows, but only while you develop in a browser:

```ts
import { isSignalRGB } from 'srgb-effect-kit';

if (!isSignalRGB()) {
  const canvas = document.querySelector('canvas')!;
  canvas.style.outline = '1px solid red';
}
```

### `RENDERER_SIGNATURES`

```ts
const RENDERER_SIGNATURES: readonly (readonly [Exclude<Renderer, 'browser'>, RegExp])[];
// [['ultralight', /\bUltralight\//i], ['qtwebengine', /\bQtWebEngine\//i]]
```

The user-agent patterns `detectRenderer` checks, in order. They are provisional until verified on real SignalRGB.

### `Renderer`

```ts
type Renderer = 'ultralight' | 'qtwebengine' | 'browser';
```

## Booleans

### `parseBoolean`

```ts
const parseBoolean: (value: SRGBBoolean | boolean | number | string) => boolean;
```

Converts a `boolean` property global to a real boolean. See [Globals → Booleans](globals.md#booleans) for why you need it.

- Booleans are returned as is.
- Numbers are `true` unless 0.
- Strings are trimmed and lowercased, then `false` only for `''`, `'0'` and `'false'`.

```ts
parseBoolean('1'); // true
parseBoolean('0'); // false
parseBoolean('false'); // false
parseBoolean(rainbow); // rainbow: SRGBBoolean
```

## Types

These types describe SignalRGB's globals. The globals themselves are declared for you by the generated types file; import these only to annotate your own code. See [Globals](globals.md).

### `SRGBEngine`

```ts
interface SRGBEngine {
  audio: EngineAudio;
  zone: EngineZone;
  vision: SRGBVision;
}
```

The type of the `engine` global. `SRGBVision` is a global interface that the generated types file extends with one `number` key per meter.

### `EngineAudio`

```ts
interface EngineAudio {
  level: number; // dB, -100 (silent) to 0 (loud)
  width: number; // stereo width, 0–1
  density: number; // 0 (pure tone) to 1 (white noise)
  freq: ArrayLike<number>; // 200 bands, may contain negative or garbage values
}
```

### `EngineZone`

```ts
interface EngineZone {
  hue: ArrayLike<number>;
  saturation: ArrayLike<number>;
  lightness: ArrayLike<number>;
}
```

560 entries per channel, row-major over the 28×20 grid.

### `CanvasApiEvent`

```ts
interface CanvasApiEvent {
  sender: string;
  event: string;
}
```

The argument of [`onCanvasApiEvent`](globals.md#oncanvasapievent).

### `SRGBBoolean`

```ts
type SRGBBoolean = '0' | '1';
```

The raw value of a `boolean` property global. Provisional until verified on real SignalRGB; read it with [`parseBoolean`](#parseboolean). It is also available as a global type, without an import.
