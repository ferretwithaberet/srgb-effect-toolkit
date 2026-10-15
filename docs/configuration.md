# Configuration

Everything about your effect that SignalRGB reads from `<head>` (name, metadata, controls and screen meters) is declared once, in the `srgbEffect()` options in `vite.config.ts`. This page covers every option, the markup each one generates, and the validation rules.

Related: [Getting started](getting-started.md) · [Globals](globals.md) · [Build](build.md)

```ts
import { srgbEffect } from 'srgb-effect-kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [srgbEffect({ title: 'My Effect' /* , … */ })],
});
```

## `srgbEffect()`

```ts
function srgbEffect<const P extends readonly PropertyDef[] = readonly []>(
  options: Omit<SrgbEffectOptions, 'properties'> & { properties?: CheckedProperties<P> },
): Plugin[];
```

`srgbEffect()` validates `options` (see [Validation](#validation)) and returns three Vite plugins. Put the returned array in Vite's `plugins` array as is; Vite flattens it.

- `srgb-effect:core` writes the [generated types file](globals.md#how-the-typing-works), injects the generated `<head>` markup in `pnpm dev`, and rejects hand-written `<title>` and SignalRGB `<meta>` tags.
- `srgb-effect:build` runs only during `vite build` and produces the [single-file effect](build.md#what-the-build-produces).
- `srgb-effect:module-scope-check` warns about [module-scoped change handlers](globals.md#do-not-declare-handlers-at-module-scope).

The `const` type parameter makes TypeScript infer the `properties` array with its literal values, such as `['Wave', 'Solid']` rather than `string[]`. `CheckedProperties<P>` uses those literals to [check each list `default` at compile time](#compile-time-check-for-list-defaults).

### Types exported from `srgb-effect-kit/vite`

Import these with `import type { … } from 'srgb-effect-kit/vite'`:

- `SrgbEffectOptions`: the options object, that is `EffectManifest` plus the plugin settings in the table below.
- `DevtoolsOptions`: the object form of the `devtools` option, `{ fireChangedOnLoad?: boolean }`.
- `ResolvedOptions`: the options after defaults are applied, split into `manifest` and the plugin settings.
- `CheckedProperties<P>`: the `properties` type that turns a list `default` outside its `values` into a type error.
- `EffectManifest`: `title`, `description`, `publisher`, `properties` and `meters`.
- `PropertyDef`: union of the six property interfaces below.
- `PropertyType`: `'number' | 'hue' | 'boolean' | 'color' | 'textfield' | 'list'`.
- `NumberProperty`, `HueProperty`, `BooleanProperty`, `ColorProperty`, `TextfieldProperty`, `ListProperty`: one per [control type](#properties).
- `MeterDef`: union of the four meter interfaces below.
- `MeterType`: `'linear' | 'area' | 'ocr_textmatch' | 'ocr_numeric'`.
- `LinearMeter`, `AreaMeter`, `OcrTextMatchMeter`, `OcrNumericMeter`: one per [meter type](#meters).
- `ResolutionDef`: one entry of a meter's [`resolutions`](#resolutions).
- `HslRanges`: the `h`, `s` and `l` ranges of `linear` and `area` meters, also used for `hdr`.
- `Range`: an inclusive `[min, max]` pair, written as `"min-max"`.

For example, to keep the properties in their own module without losing the list check, mark the array `as const`:

```ts
import type { PropertyDef } from 'srgb-effect-kit/vite';

export const properties = [
  { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
  { property: 'mode', type: 'list', label: 'Mode', values: ['Wave', 'Solid'], default: 'Wave' },
] as const satisfies readonly PropertyDef[];
```

## Options

| Option        | Type                                         | Default                     | Meaning                                                                                                |
| ------------- | -------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `title`       | `string`                                     | required                    | Effect name in SignalRGB, written as `<title>`. Also the source of the default `fileName`.             |
| `description` | `string`                                     | none                        | Written as `<meta description="…" />`.                                                                 |
| `publisher`   | `string`                                     | none                        | Written as `<meta publisher="…" />`.                                                                   |
| `properties`  | `PropertyDef[]`                              | `[]`                        | User controls, in UI order. See [Properties](#properties).                                             |
| `meters`      | `MeterDef[]`                                 | `[]`                        | Screen meters. See [Meters](#meters).                                                                  |
| `typesFile`   | `string`                                     | `'src/srgb-effect.d.ts'`    | Where the generated globals typings are written, relative to the Vite root. See [Globals](globals.md). |
| `fileName`    | `string`                                     | kebab-cased title + `.html` | Build output file name. See [Build](build.md#output-file-name).                                        |
| `script`      | `'classic' \| 'module'`                      | `'classic'`                 | How the effect script is emitted. See [Build](build.md#script-classic-and-module).                     |
| `dropConsole` | `boolean`                                    | `true`                      | Removes `console.*` and `debugger` from the build. See [Build](build.md#dropconsole-and-minification). |
| `target`      | `string \| string[]`                         | `'es2020'`                  | Build target passed to Vite's `build.target`. Provisional until verified on SignalRGB.                 |
| `devtools`    | `boolean \| { fireChangedOnLoad?: boolean }` | `true`                      | Dev-only devtools drawer. Not built yet; see below.                                                    |

The devtools drawer is planned but not built yet. It will simulate property controls, audio, screen zones, meters, canvas API events, renderers and frame rates, and mark the visible 320×200 area. `devtools` already accepts `true`, `false` or `{ fireChangedOnLoad }`. `fireChangedOnLoad` defaults to `true`; it will make the drawer call every `on<Prop>Changed` once at load, like SignalRGB does. Today the option has no effect.

## Generated `<head>`

The plugin writes these tags into `<head>`, in this order: `<title>`, `description`, `publisher`, the properties in array order, then the meters in array order. Attribute values are HTML-escaped, so quotes and ampersands are safe:

```ts
srgbEffect({ title: 'Hue Cycle & More', description: 'Cycles "hues"', publisher: 'you' });
```

<!-- prettier-ignore -->
```html
<title>Hue Cycle &amp; More</title>
<meta description="Cycles &quot;hues&quot;" />
<meta publisher="you" />
```

Do not write a `<title>` or any of these `<meta>` tags in `index.html` yourself; the plugin rejects them. See [Build errors](build.md#errors-and-warnings).

## Properties

Each property becomes a control in SignalRGB's UI and a global variable in your code. The order of the `properties` array is the order of the controls in the UI.

Every property has these fields:

| Field      | Type      | Meaning                                                                                                                                         |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `property` | `string`  | Name of the global SignalRGB creates. Its change handler is `on` + first letter uppercased + `Changed`, for example `speed` → `onSpeedChanged`. |
| `type`     | see below | Control type.                                                                                                                                   |
| `label`    | `string`  | Text shown next to the control.                                                                                                                 |
| `default`  | see below | Initial value.                                                                                                                                  |
| `tooltip`  | `string`  | Optional hover text.                                                                                                                            |

The six control types follow. Each shows a config with one property, the `<meta>` it generates, and the type of its global. [Globals](globals.md) explains how to read them.

### `number`

A slider. `min`, `max` and `default` are required whole numbers.

```ts
srgbEffect({
  title: 'Demo',
  properties: [
    {
      property: 'speed',
      type: 'number',
      label: 'Speed',
      min: 0,
      max: 100,
      default: 50,
      tooltip: 'How fast the wave moves',
    },
  ],
});
```

<!-- prettier-ignore -->
```html
<meta property="speed" label="Speed" type="number" min="0" max="100" default="50" tooltip="How fast the wave moves" />
```

Global: `speed: number`. SignalRGB's testing guidelines recommend 0–100 sliders where possible.

### `hue`

A hue slider. `min` and `max` are optional and default to `0` and `360`.

```ts
srgbEffect({
  title: 'Demo',
  properties: [
    { property: 'baseHue', type: 'hue', label: 'Base hue', default: 200 },
    { property: 'warmHue', type: 'hue', label: 'Warm hue', min: 0, max: 60, default: 30 },
  ],
});
```

<!-- prettier-ignore -->
```html
<meta property="baseHue" label="Base hue" type="hue" min="0" max="360" default="200" />
<meta property="warmHue" label="Warm hue" type="hue" min="0" max="60" default="30" />
```

Global: `baseHue: number`.

### `boolean`

A toggle. `default` is a `boolean`, written as `"1"` or `"0"`.

```ts
srgbEffect({
  title: 'Demo',
  properties: [{ property: 'rainbow', type: 'boolean', label: 'Rainbow', default: true }],
});
```

<!-- prettier-ignore -->
```html
<meta property="rainbow" label="Rainbow" type="boolean" default="1" />
```

Global: `rainbow: SRGBBoolean`, the raw `'0' | '1'` value. Read it with `parseBoolean(rainbow)`. See [Globals](globals.md#booleans).

### `color`

A color picker. `default` is a `#rrggbb` hex color. The plugin adds `min="0" max="360"`, because SignalRGB's documentation always pairs color pickers with them.

```ts
srgbEffect({
  title: 'Demo',
  properties: [{ property: 'tint', type: 'color', label: 'Tint', default: '#009bde' }],
});
```

<!-- prettier-ignore -->
```html
<meta property="tint" label="Tint" type="color" min="0" max="360" default="#009bde" />
```

Global: `tint: string`.

### `textfield`

A text input. `default` may be empty.

```ts
srgbEffect({
  title: 'Demo',
  properties: [{ property: 'message', type: 'textfield', label: 'Message', default: '' }],
});
```

<!-- prettier-ignore -->
```html
<meta property="message" label="Message" type="textfield" default="" />
```

Global: `message: string`.

### `list`

A dropdown. `values` lists the options in display order, and `default` must be one of them.

```ts
srgbEffect({
  title: 'Demo',
  properties: [
    { property: 'mode', type: 'list', label: 'Mode', values: ['Wave', 'Pulse'], default: 'Wave' },
  ],
});
```

<!-- prettier-ignore -->
```html
<meta property="mode" label="Mode" type="list" values="Wave,Pulse" default="Wave" />
```

Global: `mode: 'Wave' | 'Pulse'`, the union of `values`. SignalRGB separates values with commas, so a value must not contain one.

#### Compile-time check for list defaults

When you write the `properties` array inline in the `srgbEffect()` call, TypeScript checks that each list `default` is one of its `values`. A wrong default makes the whole entry a type error, reported on each of its fields. For example, `default: 'Pulse'` in the [getting-started](getting-started.md) config, whose values are `['Wave', 'Solid']`, gives:

```text
vite.config.ts(13,11): error TS2322: Type '"mode"' is not assignable to type 'never'.
vite.config.ts(14,11): error TS2322: Type '"list"' is not assignable to type 'never'.
…
```

Your editor shows this error. The template's `tsc` only checks `src`, so add `vite.config.ts` to the `include` array in `tsconfig.json` if you want `pnpm build` to catch it too. The check also works for an array declared elsewhere with `as const`, as [shown above](#types-exported-from-srgb-effect-kitvite), and then reports `Type '"Pulse"' is not assignable to type '"Wave" | "Solid"'` on the call. Without `as const`, TypeScript cannot see the literal values and skips the check. The runtime validation still reports `default "…" is not one of values` when Vite loads the config.

## Meters

Screen meters ask SignalRGB to watch a region of the user's screen, for example a game's health bar. You read each meter's current value as `engine.vision.<meter>`, which the generated types declare as a `number`. [Globals](globals.md#enginevision) and [`createMeter`](runtime-api.md#createmeter) cover reading them.

Every meter has these fields:

| Field         | Type              | Meaning                                                                                     |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------- |
| `meter`       | `string`          | Name, readable as `engine.vision.<meter>`. Must be a unique JavaScript identifier.          |
| `type`        | see below         | Meter type.                                                                                 |
| `x`, `y`      | `number`          | Top-left corner, normalized 0–1 from the top-left of the screen.                            |
| `width`       | `number`          | Normalized 0–1. `x + width` must be ≤ 1.                                                    |
| `height`      | `number`          | Normalized 0–1, all types except `linear`. `y + height` must be ≤ 1.                        |
| `tags`        | `string[]`        | Optional. Written comma-separated, so a tag must not contain a comma.                       |
| `resolutions` | `ResolutionDef[]` | Optional region overrides per screen size or aspect ratio. See [Resolutions](#resolutions). |

A meter that extends beyond the screen crashes SignalRGB, so the plugin rejects any region whose `x + width` or `y + height` exceeds 1. Meters are written to `<head>` in array order. SignalRGB's documentation warns that a faulty meter can disable the meters declared after it.

### `linear`

Watches a single row of pixels. Its value is the fraction of pixels (0–1) whose color falls inside the `h`, `s` and `l` ranges. Each range is an inclusive `[min, max]` pair: `h` within 0–360, `s` and `l` within 0–100.

`hdr` is optional and holds a second set of ranges, written as `hdr-h`, `hdr-s` and `hdr-l`, for screens running in HDR.

```ts
srgbEffect({
  title: 'Demo',
  meters: [
    {
      meter: 'health',
      type: 'linear',
      tags: ['fortnite'],
      x: 0.05,
      y: 0.9,
      width: 0.19,
      h: [70, 140],
      s: [40, 100],
      l: [40, 100],
      hdr: { h: [70, 140], s: [30, 100], l: [60, 100] },
    },
  ],
});
```

<!-- prettier-ignore -->
```html
<meta meter="health" type="linear" tags="fortnite" x="0.05" y="0.9" width="0.19" h="70-140" s="40-100" l="40-100" hdr-h="70-140" hdr-s="30-100" hdr-l="60-100" />
```

### `area`

Like `linear`, but watches a rectangle, so it also takes `height`. Its value is the fraction of matching pixels (0–1). It accepts `hdr` too.

```ts
srgbEffect({
  title: 'Demo',
  meters: [
    {
      meter: 'shield',
      type: 'area',
      x: 0.4,
      y: 0.85,
      width: 0.2,
      height: 0.05,
      h: [180, 220],
      s: [50, 100],
      l: [30, 80],
    },
  ],
});
```

<!-- prettier-ignore -->
```html
<meta meter="shield" type="area" x="0.4" y="0.85" width="0.2" height="0.05" h="180-220" s="50-100" l="30-80" />
```

### `ocr_textmatch`

Reads text in a rectangle and looks for `string`. Its value is 1 when the string is found, 0 when it is not, and -1 when SignalRGB is unsure. `confidence` is optional, between 0 and 100, and defaults to 70. The plugin always writes it.

```ts
srgbEffect({
  title: 'Demo',
  meters: [
    {
      meter: 'victory',
      type: 'ocr_textmatch',
      x: 0.35,
      y: 0.1,
      width: 0.3,
      height: 0.1,
      string: 'VICTORY',
    },
  ],
});
```

<!-- prettier-ignore -->
```html
<meta meter="victory" type="ocr_textmatch" x="0.35" y="0.1" width="0.3" height="0.1" string="VICTORY" confidence="70" />
```

### `ocr_numeric`

Reads a number in a rectangle. Its value is the integer read, or -1 when reading fails. `confidence` works as for `ocr_textmatch`.

```ts
srgbEffect({
  title: 'Demo',
  meters: [
    {
      meter: 'ammo',
      type: 'ocr_numeric',
      x: 0.85,
      y: 0.9,
      width: 0.1,
      height: 0.05,
      confidence: 90,
    },
  ],
});
```

<!-- prettier-ignore -->
```html
<meta meter="ammo" type="ocr_numeric" x="0.85" y="0.9" width="0.1" height="0.05" confidence="90" />
```

### Resolutions

A game's UI can sit in a different place on other screen shapes. `resolutions` overrides the meter's region for one screen size (`size: 'WIDTHxHEIGHT'`) or one aspect ratio (`aspect: 'W:H'`). Each entry needs exactly one of `size` or `aspect`, plus any of `x`, `y`, `width` and `height` to override. Omitted fields keep the meter's own values, and screens that match no entry use the meter's own region. `linear` meters have no height, so their overrides must not set `height`.

```ts
srgbEffect({
  title: 'Demo',
  meters: [
    {
      meter: 'health',
      type: 'linear',
      x: 0.05,
      y: 0.9,
      width: 0.19,
      h: [70, 140],
      s: [40, 100],
      l: [40, 100],
      resolutions: [
        { size: '2560x1080', x: 0.13, width: 0.14 },
        { aspect: '32:9', x: 0.27, width: 0.1 },
      ],
    },
  ],
});
```

SignalRGB requires overrides as children of a non-void `<meta>` … `</meta>` element, so the plugin writes:

<!-- prettier-ignore -->
```html
<meta meter="health" type="linear" x="0.05" y="0.9" width="0.19" h="70-140" s="40-100" l="40-100">
  <resolution size="2560x1080" x="0.13" width="0.14" />
  <resolution aspect="32:9" x="0.27" width="0.1" />
</meta>
```

The screen-bounds check applies to each override after merging it with the meter's region.

## Validation

The plugin validates the options when Vite loads `vite.config.ts`, so `pnpm dev` and `pnpm build` both stop before doing anything. It reports every issue at once, each prefixed with where it was found:

```text
[srgb-effect] Invalid effect manifest:
  - title: must not be empty
  - properties[0] ("name"): "name" collides with a built-in global; SignalRGB injects properties as window globals
  - properties[0] ("name"): must satisfy min ≤ default ≤ max (got 0 ≤ 20 ≤ 10)
  - properties[1] ("mode"): default "C" is not one of values
  - meters[0] ("hp"): x + width must be ≤ 1 (meters outside the screen crash SignalRGB)
```

The prefix is `properties[i] ("name")` or `meters[i] ("name")`, or just `properties[i]` / `meters[i]` when the name itself is missing. Resolution issues append `resolutions[j]` to the prefix, and `hdr` range issues append `hdr`, as in `meters[0] ("hp") resolutions[1]:`. Because configs can also be plain JavaScript, every field is checked, not only those TypeScript would catch. In the messages below, `<…>` stands for a value from your config. Where a message echoes an offending value, a string appears in double quotes, as in `unknown type "slider"`.

### Effect rules

| Rule                                          | Message                                                        |
| --------------------------------------------- | -------------------------------------------------------------- |
| The options are an object                     | `manifest: must be an object`                                  |
| `title` is a non-empty string                 | `title: must be a string`, `title: must not be empty`          |
| `description`, `publisher` are strings if set | `description: must be a string`, `publisher: must be a string` |
| `properties`, `meters` are arrays if set      | `properties: must be an array`, `meters: must be an array`     |

### Property rules

| Rule                                                                                                                                                              | Message                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Each entry is an object                                                                                                                                           | `must be an object`                                                                            |
| `property` is a string                                                                                                                                            | `property must be a string`                                                                    |
| `property` is a valid JavaScript identifier (ASCII letters, digits, `_` and `$`; must not start with a digit) and not a reserved word such as `class` or `delete` | `property must be a valid JavaScript identifier`                                               |
| Names are unique                                                                                                                                                  | `duplicate property name`                                                                      |
| `property` is not a browser global (for example `name`, `status`, `top`, `length`, `close`, `event`) or a SignalRGB global (`engine`, `onCanvasApiEvent`)         | `"<property>" collides with a built-in global; SignalRGB injects properties as window globals` |
| Two properties do not share a change handler (for example `speed` and `Speed`)                                                                                    | `change handler <handler> collides with property "<other>"`                                    |
| `label` is a non-empty string                                                                                                                                     | `label must be a string`, `label must not be empty`                                            |
| `type` is one of the six types                                                                                                                                    | `unknown type <type>`                                                                          |
| `tooltip` is a string if set                                                                                                                                      | `tooltip must be a string`                                                                     |
| `number`: `min`, `max`, `default` are whole numbers                                                                                                               | `min, max and default must be whole numbers`                                                   |
| `number`: `min ≤ default ≤ max`                                                                                                                                   | `must satisfy min ≤ default ≤ max (got <min> ≤ <default> ≤ <max>)`                             |
| `hue`: `default`, `min`, `max` are numbers                                                                                                                        | `default must be a number`, `min and max must be numbers`                                      |
| `hue`: `0 ≤ min ≤ default ≤ max ≤ 360`                                                                                                                            | `must satisfy 0 ≤ min ≤ default ≤ max ≤ 360 (got <min>, <default>, <max>)`                     |
| `boolean`: `default` is a boolean                                                                                                                                 | `default must be a boolean`                                                                    |
| `color`: `default` is `#rrggbb` (six hex digits, any case)                                                                                                        | `default must be a #rrggbb hex color (got "<default>")`                                        |
| `textfield`: `default` is a string                                                                                                                                | `default must be a string`                                                                     |
| `list`: `values` is a non-empty array of strings                                                                                                                  | `values must be an array of strings`, `values must not be empty`                               |
| `list`: values are unique                                                                                                                                         | `duplicate value "<value>"`                                                                    |
| `list`: values contain no commas                                                                                                                                  | `value "<value>" must not contain commas (SignalRGB separates values with commas)`             |
| `list`: `default` is one of `values`                                                                                                                              | `default must be a string`, `default "<default>" is not one of values`                         |

The browser-global list comes from TypeScript's DOM and ES library declarations. Meter names are not checked against it, because meters live on `engine.vision`, not on `window`.

### Meter rules

| Rule                                                                         | Message                                                                                                                                   |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Each entry is an object                                                      | `must be an object`                                                                                                                       |
| `meter` is a string and a valid identifier, by the same rule as `property`   | `meter must be a string`, `meter must be a valid JavaScript identifier`                                                                   |
| Names are unique                                                             | `duplicate meter name`                                                                                                                    |
| `type` is one of the four types                                              | `unknown type <type>`                                                                                                                     |
| `x`, `y`, `width`, `height` are finite numbers                               | `<field> must be a finite number (got <value>)`                                                                                           |
| …between 0 and 1                                                             | `<field> must be between 0 and 1 (got <value>)`                                                                                           |
| The region stays on screen                                                   | `x + width must be ≤ 1 (meters outside the screen crash SignalRGB)`, `y + height must be ≤ 1 (meters outside the screen crash SignalRGB)` |
| `linear`/`area`: `h`, `s`, `l` are `[min, max]` pairs                        | `<h, s or l> must be a [min, max] pair of numbers`                                                                                        |
| …with `0 ≤ min ≤ max ≤ 360` for `h` and `≤ 100` for `s` and `l`              | `<h, s or l> range must satisfy 0 ≤ min ≤ max ≤ <360 or 100> (got <min>-<max>)`                                                           |
| `hdr` is an object with `h`, `s`, `l` ranges, checked like the above         | `hdr must be an object with h, s and l ranges`                                                                                            |
| `ocr_textmatch`: `string` is a non-empty string                              | `string must be a string`, `string must not be empty`                                                                                     |
| OCR meters: `confidence` is 0–100 if set                                     | `confidence must be a number between 0 and 100`                                                                                           |
| `tags` is an array of strings without commas                                 | `tags must be an array of strings`, `tag "<tag>" must not contain commas (SignalRGB separates tags with commas)`                          |
| `resolutions` is an array of objects                                         | `resolutions must be an array`, `must be an object`                                                                                       |
| Each override has exactly one of `size`, `aspect`                            | `exactly one of size or aspect is required`                                                                                               |
| `size` looks like `1920x1080`                                                | `size must look like "1920x1080" (got <size>)`                                                                                            |
| `aspect` looks like `16:9` (decimals allowed, e.g. `3.55:1`)                 | `aspect must look like "16:9" (got <aspect>)`                                                                                             |
| No `height` on `linear` overrides                                            | `height is not allowed on linear meters`                                                                                                  |
| Each override, merged with the meter's region, passes the region rules above | as above, with `resolutions[j]` in the prefix                                                                                             |

### `fileName`

`fileName` is checked separately and fails with its own message:

```text
[srgb-effect] fileName must be a plain file name ending in .html (got "out/x.html")
```

It must end in `.html` and contain no `/` or `\`.
