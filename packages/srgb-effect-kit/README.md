# srgb-effect-kit

Build [SignalRGB](https://signalrgb.com/) effects (Lightscripts) with Vite and TypeScript.

- Declare the effect's metadata, controls and screen meters once, in `vite.config.ts`.
- Use SignalRGB's globals directly: every property, `on<Property>Changed` handler, `engine` and `onCanvasApiEvent` is typed.
- `vite build` produces one self-contained HTML file to drop into SignalRGB.
- Optional helpers for frame loops, colors, audio, screen zones, meters and renderer detection.

ESM-only. Requires Node.js 22.12 or newer and Vite 8.3 or newer (`vite ^8.3.0` peer dependency).

## Install

Create a Vite project first, then add the package:

```sh
pnpm create vite my-effect --template vanilla-ts
cd my-effect
pnpm install
pnpm add srgb-effect-kit
```

It is a regular dependency because effect code imports the runtime from `src/`, which lint rules such as airbnb's `import-x/no-extraneous-dependencies` flag for devDependencies. `-D` also works if your lint setup allows it.

## Usage

```ts
// vite.config.ts
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
      ],
    }),
  ],
});
```

```ts
// src/main.ts
import { createLoop, hsl } from 'srgb-effect-kit';

const ctx = document.querySelector('canvas')!.getContext('2d')!;
let hue = 0;

createLoop(({ dt }) => {
  hue = (hue + speed * 3.6 * dt) % 360; // `speed` is the property global, typed as number
  ctx.fillStyle = hsl(hue, 100, 50);
  ctx.fillRect(0, 0, 320, 200);
}).start();
```

`index.html` holds only your page body, for example `<canvas width="320" height="200"></canvas>`. Do not write `<title>` or SignalRGB `<meta>` tags; the plugin generates them.

Good to know:

- The plugin writes `src/srgb-effect.d.ts`, which types your globals, on every `vite` and `vite build`. Do not commit it: add it to `.gitignore` (Prettier respects `.gitignore`). Because the file does not exist on a fresh clone, change the template's `"build": "tsc && vite build"` to `"build": "vite build && tsc"`; running `pnpm dev` once also generates it for your editor.
- `pnpm dev` runs your effect in the browser: the devtools define SignalRGB's globals before your code and add a drawer for the property controls, audio, screen zones, meters, canvas API events and renderer/FPS simulation. They are never part of the build.
- Assign change handlers to `window` (`window.onSpeedChanged = () => {}`). A top-level `function onSpeedChanged() {}` is module-scoped and never called; the plugin warns about it.
- `dropConsole` (default `true`) strips `console.*` for SignalRGB's clean-console requirement, and minifies the script even when `build.minify` is `false`. It also strips third-party libraries' `console.*` calls, so set `dropConsole: false` to debug a production build.

## Documentation

- [Getting started](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/getting-started.md): the full walkthrough, from an empty folder to an installed effect.
- [Configuration](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/configuration.md): every option, the generated markup, and the validation rules.
- [Globals](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/globals.md): property globals, change handlers, `engine` and `onCanvasApiEvent`.
- [Runtime API](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/runtime-api.md): reference for every export of `srgb-effect-kit`.
- [Devtools](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/devtools.md): how `pnpm dev` simulates SignalRGB.
- [Build](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/build.md): the build output, the `script` modes (module by default), and every build error and warning.
- [SignalRGB notes](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/signalrgb-notes.md): renderers, frame rate, and what is still unverified.

## License

MIT
