# srgb-effect-kit

A Vite plugin and TypeScript runtime for building [SignalRGB](https://signalrgb.com/) effects (Lightscripts).

You declare the effect's metadata, controls and screen meters once, in `vite.config.ts`. You use SignalRGB's globals directly, fully typed. `vite build` produces the single self-contained HTML file SignalRGB loads.

## Install

An effect is a Vite project, so create one first. You need Node.js 22.12 or newer and pnpm.

```sh
pnpm create vite my-effect --template vanilla-ts
cd my-effect
pnpm install
```

Then add the toolkit:

```sh
pnpm add srgb-effect-kit
```

It is a regular dependency because effect code imports the runtime from `src/`, which lint rules such as airbnb's `import-x/no-extraneous-dependencies` flag for devDependencies. `-D` also works if your lint setup allows it.

## Quick start

Create `vite.config.ts`:

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
      ],
    }),
  ],
});
```

Clean up the template: remove `<title>` and the favicon `<link>` from `index.html`, delete `public/`, `src/counter.ts`, `src/style.css`, `src/assets/` and `src/main.ts`, and replace `<div id="app"></div>` with `<canvas width="320" height="200"></canvas>`.

Write `src/main.ts`:

```ts
import { createLoop, hsl } from 'srgb-effect-kit';

const ctx = document.querySelector('canvas')!.getContext('2d')!;
let hue = 0;

createLoop(({ dt }) => {
  hue = (hue + speed * 3.6 * dt) % 360; // `speed` is the property global, typed as number
  ctx.fillStyle = hsl(hue, 100, 50);
  ctx.fillRect(0, 0, 320, 200);
}).start();
```

Add `src/srgb-effect.d.ts` to `.gitignore`: it is generated on every `vite` and `vite build`, so do not commit it. Because the template's `"build": "tsc && vite build"` would run `tsc` before the file exists on a fresh clone, change the script to `"build": "vite build && tsc"`. `pnpm dev` also generates the types for your editor. It runs the effect in the browser, with [devtools](docs/devtools.md) that simulate SignalRGB's globals, controls, audio, screen, meters and canvas API events. Then build:

```sh
pnpm dev
pnpm build
```

Copy `dist/my-effect.html` into `C:\Users\<username>\AppData\Local\VortxEngine\app-<version>\Signal-x64\Effects\Dynamic\` and restart SignalRGB. The effect appears under "Installed".

[Getting started](docs/getting-started.md) walks through each step and explains why it is needed.

## Documentation

- [Getting started](docs/getting-started.md): the full walkthrough, from an empty folder to an installed effect.
- [Configuration](docs/configuration.md): every `srgbEffect()` option, the markup each control and meter generates, and the validation rules.
- [Globals](docs/globals.md): property globals, `on<Prop>Changed` handlers, `engine` and `onCanvasApiEvent`, and how they are typed.
- [Runtime API](docs/runtime-api.md): reference for the loop, color, audio, screen-zone, meter, renderer and boolean helpers.
- [Devtools](docs/devtools.md): how `pnpm dev` simulates SignalRGB, and each tab of the drawer.
- [Build](docs/build.md): what `vite build` produces, the `script` modes (module by default), and every build error and warning.
- [SignalRGB notes](docs/signalrgb-notes.md): renderers, frame rate, the visible area, and what is still unverified.

## Examples

- [basic-2d](examples/basic-2d): a rainbow wave on a 2D canvas with number, hue, boolean and list controls.
- [audio-visualizer](examples/audio-visualizer): frequency bars driven by `engine.audio`.

## Contributing

This repository is a pnpm workspace. [mise](https://mise.jdx.dev/) pins the Node.js version, and corepack provides the pnpm version from `package.json`:

```sh
mise install
corepack enable
pnpm install
```

CI runs these checks; run them before you open a pull request:

```sh
pnpm lint
pnpm format
pnpm build
pnpm typecheck
pnpm test
```

CI runs the build before the typecheck, so the examples generate their git-ignored `src/srgb-effect.d.ts` before it is checked. `pnpm format:fix` applies Prettier.

The devtools also have end-to-end tests. They drive `examples/basic-2d` in Chromium against the built package:

```sh
pnpm build
pnpm exec playwright install chromium   # once; or set CHROMIUM_PATH to a local Chromium
CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e   # or just `pnpm test:e2e` with Playwright's own Chromium
```

Layout:

- `packages/srgb-effect-kit/`: the published package. `src/vite` is the Vite plugin, `src/runtime` the code that ships inside effects, and `src/shared` the environment-independent manifest types, validation, `<meta>` serializer and type generator.
- `examples/`: example effects, built against the workspace package.
- `docs/`: user documentation.

Status: the plugin, the runtime and the devtools are built. The probe effect that verifies behaviour on real SignalRGB (the upcoming SignalRGB probe) is not built yet, so the simulated user agents, raw formats and load-time call order are provisional.

## License

[MIT](LICENSE)
