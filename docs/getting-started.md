# Getting started

This walkthrough takes you from an empty folder to a SignalRGB effect built with Vite, TypeScript and `srgb-effect-kit`.

You need Node.js 22.12 or newer and pnpm. To try the result, you need SignalRGB on Windows.

## 1. Create a Vite project

`srgb-effect-kit` is a Vite plugin, so start from a plain Vite project. The `vanilla-ts` template gives you Vite and TypeScript without a UI framework.

```sh
pnpm create vite my-effect --template vanilla-ts
cd my-effect
pnpm install
```

If create-vite asks "Install with pnpm and start now?", choose No. You install the dependencies with the commands above.

## 2. Add srgb-effect-kit

```sh
pnpm add -D srgb-effect-kit
```

It is a dev dependency: the plugin runs at build time, and the few runtime helpers you import get bundled into the effect.

## 3. Create `vite.config.ts`

The template does not ship a Vite config, so create `vite.config.ts` in the project root:

```ts
import { srgbEffect } from 'srgb-effect-kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    srgbEffect({
      title: 'My Effect',
      description: 'A scrolling rainbow',
      publisher: 'your-name',
      properties: [
        { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
        {
          property: 'mode',
          type: 'list',
          label: 'Mode',
          values: ['Wave', 'Solid'],
          default: 'Wave',
        },
      ],
    }),
  ],
});
```

`title`, `description` and `publisher` become the effect's name and metadata in SignalRGB. Each entry in `properties` becomes a control in SignalRGB's UI and a global variable in your code: here `speed` and `mode`. [Configuration](configuration.md) lists every option.

## 4. Clean up the template

The template is a demo page. An effect is a single HTML file whose `<head>` the plugin writes for you, so remove the parts that would get in the way:

- **Remove `<title>` from `index.html`.** The plugin generates the title from `title` in your config and fails on a hand-written one.
- **Remove the favicon `<link>` from `index.html` and delete the `public/` folder.** SignalRGB loads one HTML file, and files in `public/` are not inlined into it. The plugin warns when `public/` contains files.
- **Delete `src/counter.ts`, `src/style.css`, `src/assets/` and `src/main.ts`.** They are the demo app. You write a new `src/main.ts` in the next step.
- **Replace `<div id="app"></div>` with `<canvas width="320" height="200"></canvas>`.** SignalRGB shows only the top-left 320×200 pixels of the page, so a canvas of that size covers the visible area.

Also add a `<style>` block that removes the body margin. Without it, the browser's default 8px margin shifts the canvas out of the visible area.

`index.html` now looks like this:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        margin: 0;
        background: #000;
      }
    </style>
  </head>
  <body>
    <canvas width="320" height="200"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Keep the `<script type="module" src="/src/main.ts">` tag. It is Vite's entry point, and the build turns it into an inline script.

## 5. Write `src/main.ts`

```ts
import { createLoop, hsl } from 'srgb-effect-kit';

const ctx = document.querySelector('canvas')!.getContext('2d')!;
let hue = 0;

// SignalRGB calls this at load and whenever the user picks another mode.
window.onModeChanged = () => {
  hue = 0;
};

createLoop(({ dt }) => {
  // `speed` and `mode` are the globals SignalRGB creates from your properties.
  hue = (hue + speed * 3.6 * dt) % 360;
  for (let x = 0; x < 320; x += 4) {
    const offset = mode === 'Wave' ? (x / 320) * 360 : 0;
    ctx.fillStyle = hsl((hue + offset) % 360, 100, 50);
    ctx.fillRect(x, 0, 4, 200);
  }
}).start();
```

- `speed` and `mode` are read directly. SignalRGB keeps them up to date, and they are typed from your config: `speed` is a `number`, and `mode` is `'Wave' | 'Solid'`.
- `window.onModeChanged` is the change handler for `mode`. Assign handlers to `window`; a top-level `function onModeChanged() {}` is never called. [Globals](globals.md) explains why.
- `createLoop` and `hsl` are optional helpers from the [runtime API](runtime-api.md).

Your editor shows errors for `speed`, `mode` and `onModeChanged` until the next step generates their types.

## 6. Run the dev server

```sh
pnpm dev
```

When Vite loads your config, the plugin writes `src/srgb-effect.d.ts`. This file declares a global for each property and its change handler, and pulls in the types of SignalRGB's own globals such as `engine`. Do not commit it: it is generated, and Vite regenerates it on every `vite` and `vite build`. Add it to `.gitignore`:

```text
src/srgb-effect.d.ts
```

Prettier respects `.gitignore` by default, so it needs no separate ignore entry.

Then reorder the build script in `package.json`. The template's `"build": "tsc && vite build"` type-checks before Vite has generated `src/srgb-effect.d.ts`, so on a fresh clone it fails with `Cannot find name 'speed'`. Use:

```json
"build": "vite build && tsc"
```

Running `pnpm dev` once also generates the file, so your editor knows the globals before the first build.

Open the URL Vite prints and view the page source. The `<head>` contains the generated `<title>` and `<meta>` tags:

```html
<title>My Effect</title>
<meta description="A scrolling rainbow" />
<meta publisher="your-name" />
<meta property="speed" label="Speed" type="number" min="0" max="100" default="50" />
<meta property="mode" label="Mode" type="list" values="Wave,Solid" default="Wave" />
```

The effect itself does not run in the browser yet. SignalRGB injects the property globals, and the dev server does not define them until the devtools drawer is built. For now the browser console shows `ReferenceError: speed is not defined` on every frame. Use the dev server to check the generated markup and catch config errors, and test the effect's behaviour in SignalRGB.

Stop the dev server with Ctrl+C.

## 7. Build and install the effect

```sh
pnpm build
```

The build writes one self-contained file, `dist/my-effect.html`, named after the kebab-cased `title`. Scripts (one inline `<script type="module">` by default), styles and imported assets are inlined into it. [Build](build.md) describes the output and every build error.

To install it, copy `dist/my-effect.html` into SignalRGB's effects folder:

```text
C:\Users\<username>\AppData\Local\VortxEngine\app-<version>\Signal-x64\Effects\Dynamic\
```

Then restart SignalRGB. It picks up new effect files only at startup. Your effect appears under "Installed", with the Speed and Mode controls. After later builds, copy the file again.

## 8. Next steps

- [Configuration](configuration.md): every control type and screen meter, and the validation rules.
- [Globals](globals.md): property globals, change handlers, `engine` and `onCanvasApiEvent`.
- [Runtime API](runtime-api.md): the loop, color, audio, screen-zone and meter helpers.
- [Build](build.md): the build output, the `script` modes (module by default), and build errors.
- [SignalRGB notes](signalrgb-notes.md): renderers, frame rate and what is still unverified.
- The [basic-2d](../examples/basic-2d) and [audio-visualizer](../examples/audio-visualizer) examples.
