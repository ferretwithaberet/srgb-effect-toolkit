# Build

`vite build` (or `pnpm build`) turns your project into the single HTML file SignalRGB loads. This page describes what ends up in that file, the options that shape it, and every build error and warning with its fix.

Related: [Configuration](configuration.md) · [Globals](globals.md) · [SignalRGB notes](signalrgb-notes.md)

## What the build produces

SignalRGB loads an effect from one HTML file, so the build emits exactly one: `dist/<fileName>`, by default the kebab-cased title plus `.html`. Nothing else is written to `dist/`. Each project builds one effect.

To get there, the plugin changes how Vite builds:

- **Everything is inlined.** Imported images, fonts and other assets, including `url()` references in CSS, become `data:` URLs. Stylesheets are inlined as `<style>` where their `<link>` was. Scripts are inlined at the end of `<body>`, as one inline `<script type="module">` by default.
- **One script.** Code splitting is off, so dynamic `import()` calls are bundled into the main script instead of creating extra files. Vite's module preload helper is off too.
- **No devtools.** The [devtools](devtools.md) exist only in `pnpm dev`; nothing of them reaches the build.
- **No `public/` copy.** Files in `public/` are not copied, because only the HTML file reaches SignalRGB. The build warns when `public/` has files; see [below](#public-files-are-left-out).
- **Generated `<head>`.** The `<title>` and `<meta>` tags from your options are inserted at the start of `<head>`, after a leading `<meta charset>` (browsers expect the charset first). If `index.html` has no `<head>`, one is created.
- **A prelude script.** A small classic script (always a plain `<script>`, in both `script` modes) runs before your code and creates every `on<Prop>Changed` global and `onCanvasApiEvent` that does not exist yet, set to `undefined`. That way a bare `onSpeedChanged = …` assignment does not throw in strict mode. See [Globals](globals.md#change-handlers-onpropchanged).
- **Your code at the end of `<body>`.** The bundled script follows the prelude, so the DOM above it, such as your canvas, exists when it runs. A `</script>` inside your code is escaped as `<\/script>` so it cannot end the tag early; the same applies to `</style>` in CSS.

For the [getting-started](getting-started.md) project, `dist/my-effect.html` looks like this with the default `script: 'module'` (the last script is shortened):

<!-- prettier-ignore -->
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
<title>My Effect</title>
<meta description="A scrolling rainbow" />
<meta publisher="your-name" />
<meta property="speed" label="Speed" type="number" min="0" max="100" default="50" />
<meta property="mode" label="Mode" type="list" values="Wave,Solid" default="Wave" />

    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>body{background:#000;margin:0}</style>
    </head>
  <body>
    <canvas width="320" height="200"></canvas>
  
<script>
(function(){var w=window,n=["onSpeedChanged","onModeChanged","onCanvasApiEvent"];for(var i=0;i<n.length;i++){if(!(n[i] in w))w[n[i]]=undefined;}})();
</script>
<script type="module">
var e=(e,t,n,r)=>r===void 0?`hsl(${e}, ${t}%, ${n}%)`:…
</script>
</body>
</html>
```

## `script`: classic and module

The `script` option controls how your bundled code is emitted. The default is `'module'`, which follows Vite's conventions. `'classic'` is opt-in.

### `'module'` (default)

Your code is emitted as a single inline `<script type="module">` after the classic prelude. Imports are bundled into that one script, so the file stays self-contained. Module scripts are already strict and module-scoped: assigning to an undeclared variable throws, `this` at the top level is `undefined`, and top-level declarations do not leak into the global scope, so the toolkit adds no wrapper or `"use strict"`.

The toolkit's classic-only rejections do not apply. In module mode you can use top-level `await`, `import.meta` (such as `import.meta.url`) and imports of modules that are not bundled, such as a CDN URL.

SignalRGB is known to load inline module scripts: the butterchurn-srgb effect ships an inline `<script type="module">`. Still test your own effect with both renderers, since the renderers' exact JavaScript support is [not verified yet](signalrgb-notes.md#pending-verification-on-real-signalrgb).

### `'classic'` (opt-in)

```ts
srgbEffect({ title: 'My Effect', script: 'classic' });
```

Your code is bundled as an IIFE (`(function(){ … })();`) in a plain `<script>`, preceded by `"use strict";`. Strict mode keeps the semantics your code had as a module: assigning to an undeclared variable throws, and `this` at the top level is `undefined`. Use classic for engines that cannot run module scripts. Its output looks like this instead of the module script above:

<!-- prettier-ignore -->
```html
<script>
"use strict";(function(){var e=(e,t,n,r)=>r===void 0?`hsl(${e}, ${t}%, ${n}%)`:…})();
</script>
```

The trade-off: an IIFE cannot do three things a module can, so these fail the build in classic mode:

- importing a module that is not bundled, such as a CDN URL;
- top-level `await`;
- `import.meta`, except `import.meta.env`, which Vite replaces with static values at build time.

The errors below, [external imports](#external-imports-in-classic-scripts), [top-level `await`](#top-level-await-in-classic-scripts) and [`import.meta`](#importmeta-in-classic-scripts), appear only with `script: 'classic'`.

## `dropConsole` and minification

SignalRGB's testing requirements ask for a clean console: an effect should log nothing besides SignalRGB's own "Loading Effect". With `dropConsole: true`, the default, the build removes every `console.*` call and `debugger` statement, so you can keep debug logging in your source. This also strips `console.*` calls inside third-party libraries you bundle, so to debug a production build, set `dropConsole: false`.

The removal is done by the minifier, so `dropConsole: true` also minifies the script, even if you set `build.minify: false`. To get unminified output, for example to read the bundle, set both:

```ts
import { srgbEffect } from 'srgb-effect-kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  build: { minify: false },
  plugins: [srgbEffect({ title: 'My Effect', dropConsole: false })],
});
```

With `dropConsole: false`, your `console` calls stay in the effect. Turn it back on before you share the effect.

## `target`

`target` is passed to Vite's `build.target` and decides which JavaScript syntax the build may emit. The default, `'es2020'`, is provisional: the JavaScript level SignalRGB's renderers support is [not verified yet](signalrgb-notes.md#pending-verification-on-real-signalrgb). It accepts anything `build.target` does, such as `'es2022'` or `['chrome100', 'safari15']`.

## Output file name

By default the output is named after `title`, kebab-cased: accents are removed, words and camelCase parts are joined with `-`, and everything is lowercased.

| `title`        | File name           |
| -------------- | ------------------- |
| `My Effect`    | `my-effect.html`    |
| `Basic 2D`     | `basic-2d.html`     |
| `myEffect v2!` | `my-effect-v2.html` |
| `Café Lights`  | `cafe-lights.html`  |
| `!!!`          | `effect.html`       |

Set `fileName` to choose another name. It must be a plain file name ending in `.html`; to change the folder, use Vite's `build.outDir`.

```ts
srgbEffect({ title: 'My Effect', fileName: 'my-effect-dev.html' });
```

## Custom HTML entry

The entry does not have to be called `index.html`. Point `build.rolldownOptions.input` at a single `.html` file:

```ts
export default defineConfig({
  build: { rolldownOptions: { input: 'my-effect.html' } },
  plugins: [srgbEffect({ title: 'My Effect' })],
});
```

Build errors then name that file. In `pnpm dev`, Vite has no `index.html` to serve at `/`, which would return 404. For a single non-index entry the plugin redirects `/` to the entry (`/my-effect.html`) and appends the entry path to the local and network URLs Vite prints, so you can open them directly.

## The generated types file

The plugin also writes `src/srgb-effect.d.ts` (the `typesFile` option) whenever Vite loads the config, during builds as well as `pnpm dev`. It is generated, so do not commit it: add it to `.gitignore`. Vite regenerates it on every `vite` and `vite build`. Prettier respects `.gitignore` by default, so no `.prettierignore` entry is needed. Because the file does not exist on a fresh clone, the template's `"build": "tsc && vite build"` fails until Vite has run once; use `"build": "vite build && tsc"` instead, or run `pnpm dev` once. [Globals](globals.md#how-the-typing-works) explains what the file contains.

## Errors and warnings

Every message from the plugin starts with `[srgb-effect]`. [Configuration](configuration.md#validation) lists the option validation errors, which stop Vite before it builds anything.

### Hand-written `<title>` or SignalRGB `<meta>` in the HTML entry

```text
[srgb-effect] index.html must not contain <title>: these are generated from the srgbEffect() options.
```

The message lists everything it found, separated by commas: `<title>`, `<meta property>`, `<meta meter>`, `<meta description>` and `<meta publisher>`. This check also runs in `pnpm dev`, where the page fails to load with the same message.

Open Graph and similar tags, such as `<meta property="og:title" …>`, are reported as `<meta property> (Open Graph style meta tags collide with SignalRGB controls)`, because SignalRGB reads every `<meta property>` as a control.

The message names your actual entry file, such as `butterchurn-srgb.html` when you use a custom entry. Fix: delete these tags from that file and set `title`, `description`, `publisher`, `properties` and `meters` in your config instead. Anything inside HTML comments or inside inline `<svg>`, `<script>`, `<template>` and `<style>` elements is ignored, so an SVG's own `<title>` is fine. Other meta tags, such as `<meta charset>` and `<meta name="viewport">`, are fine.

### External imports in classic scripts

```text
[srgb-effect] classic scripts cannot import external modules (https://cdn.example/confetti.js). Bundle the dependency or set script: 'module'.
```

Your code imports something the bundler cannot include, such as a URL. Fix: install the package with `pnpm add` and import it by name so it is bundled, or remove `script: 'classic'`.

### Top-level `await` in classic scripts

```text
[srgb-effect] top-level await is not supported in classic scripts. Wrap it in an async function or set script: 'module'.
```

Fix: move the code into an async function and call it, or remove `script: 'classic'`.

```ts
async function init(): Promise<void> {
  await document.fonts.ready;
  // start drawing
}
void init();
```

### `import.meta` in classic scripts

```text
[srgb-effect] /path/to/my-effect/src/main.ts uses import.meta, which is unavailable in classic scripts. Remove it (import.meta.env is fine) or set script: 'module'.
```

Common causes are `import.meta.url` and `new URL('./file', import.meta.url)`. Fix: import the asset instead (`import url from './file.png'`), which Vite inlines, or remove `script: 'classic'`.

### Files that could not be inlined

```text
[srgb-effect] build produced files that could not be inlined: assets/worker-a7Ki1QfV.js
```

Something in your code made the bundler emit a separate file, for example a Web Worker created with `new Worker(new URL('./worker.ts', import.meta.url))` in module mode. SignalRGB would only receive the HTML file, so the build stops. Fix: remove the feature that emits the file.

### More or fewer than one HTML entry

```text
[srgb-effect] expected exactly one HTML entry, found 0
```

The build produced no HTML file, for example because `build.rolldownOptions.input` points at a script instead of an HTML file. Fix: make the input a single `.html` file, or remove the custom input and keep a single `index.html` in the project root.

With several HTML inputs, the bundler fails before the plugin's check, because code splitting is off:

```text
[INVALID_OPTION] Invalid value "false" for option "output.codeSplitting" - multiple inputs are not supported when "output.codeSplitting" is false.
```

Fix: one effect per project. Put each effect in its own Vite project.

### `public/` files are left out

This is a warning; the build still succeeds:

```text
[srgb-effect] files in public are not copied into the single-file effect; import assets from source instead so they get inlined
```

Fix: move the files into `src/` and import them, so Vite inlines them, or delete `public/` if you don't need them. An empty `public/` folder does not warn.

### External references left in the HTML

A warning:

```text
[srgb-effect] https://cdn.example/lib.js is not part of the bundle and was left as an external reference
```

`index.html` contains a `<script src>` or `<link rel="stylesheet">` pointing outside the bundle, typically a CDN URL. The tag is kept as is, so the effect would need network access in SignalRGB. Fix: install the dependency and import it from your code, so it is bundled.

### Module-scoped change handlers

A warning:

```text
[srgb-effect] src/main.ts: "onSpeedChanged" is declared at module scope and will never be called by SignalRGB. Assign it instead: window.onSpeedChanged = …
```

Fix: assign the handler to `window`. See [Globals](globals.md#do-not-declare-handlers-at-module-scope).
