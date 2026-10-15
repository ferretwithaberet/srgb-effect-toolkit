# basic-2d

Rainbow wave on a 2D canvas: number, hue, boolean and list controls, with `createLoop`.

- `pnpm dev`: develop in the browser. Until the devtools land, dev mode does not define the property globals, so this effect's top-level `baseHue` read throws a `ReferenceError` there. It works inside SignalRGB.
- `pnpm build`: writes `dist/basic-2d.html`. Copy it into SignalRGB's effects folder and restart SignalRGB.
