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
pnpm add -D srgb-effect-kit
```

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

- The plugin writes `src/srgb-effect.d.ts`, which types your globals, whenever Vite loads the config. Commit it, and add it to your formatter's ignore list (for example `.prettierignore`), because the plugin rewrites it when the options change.
- The dev server does not define SignalRGB's globals yet; a dev-only devtools drawer that simulates them is planned. Until then, reading a property global or making a bare `onSpeedChanged = …` assignment throws a `ReferenceError` in the browser. Both work inside SignalRGB.
- Assign change handlers to `window` (`window.onSpeedChanged = () => {}`). A top-level `function onSpeedChanged() {}` is module-scoped and never called; the plugin warns about it.
- `dropConsole` (default `true`) strips `console.*` for SignalRGB's clean-console requirement, and minifies the script even when `build.minify` is `false`.

## Documentation

- [Getting started](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/getting-started.md): the full walkthrough, from an empty folder to an installed effect.
- [Configuration](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/configuration.md): every option, the generated markup, and the validation rules.
- [Globals](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/globals.md): property globals, change handlers, `engine` and `onCanvasApiEvent`.
- [Runtime API](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/runtime-api.md): reference for every export of `srgb-effect-kit`.
- [Build](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/build.md): the build output, the `script` modes (module by default), and every build error and warning.
- [SignalRGB notes](https://github.com/ferretwithaberet/srgb-effect-toolkit/blob/main/docs/signalrgb-notes.md): renderers, frame rate, and what is still unverified.

## License

MIT
