# SRGB Probe test plan

Two probe runs and one yes/no check. The probe logs what it finds to SignalRGB's console as `[probe] <section> <json>` lines; you copy those lines and send them back.

## Build and install

1. From the repository root, build the probe:

   ```sh
   pnpm --filter @srgb-effect-kit-examples/probe build
   ```

2. Copy `examples/probe/dist/probe-classic.html` into SignalRGB's effects folder:

   ```text
   C:\Users\<user>\AppData\Local\VortxEngine\app-<version>\Signal-x64\Effects\Dynamic\
   ```

3. Restart SignalRGB. The effect appears under **Installed** as **SRGB Probe Classic**.

The runs use only the classic build: its script runs while the page parses, so it also catches handler calls SignalRGB makes before a module script would run. The build also writes `probe.html` (module script); you don't need it here.

## Copying the console

Open SignalRGB's **Console** panel and copy every line that starts with `[probe]`, in order. Long lines arrive split as `[probe] REPORT#1/3 …`, `#2/3`, …: copy every chunk. If the console won't let you copy, send screenshots and say so. Clear the console between runs if you can.

## Run A: QtWebEngine

Renderer QtWebEngine, any FPS setting (60 is fine), music playing.

1. Select **SRGB Probe Classic**. Wait 8 s.
2. Change each control once, in order, with a single quick change each: Number, Hue, Hue 2, Boolean, Color, Text (type one character), List.
3. In a Windows terminal, run:

   ```text
   curl.exe -X POST "http://localhost:16034/canvas/event?sender=probe&event=hello"
   ```

4. Wait about 35 s, then copy all `[probe]` lines.

## Run B: UltraLight

Switch the renderer to UltraLight, then repeat Run A's steps.

## Check C: butterchurn-srgb

With music playing, select butterchurn-srgb. Does it react to the audio? Answer yes or no. Nothing to copy.

## What to send back

One block per run:

```text
Run: A
Renderer: QtWebEngine
FPS setting: 60
Notes: anything odd, or nothing

[probe] alive {...}
[probe] prop-watch-start {...}
...
```

Then, for Check C: `Check C: yes` or `Check C: no`.

Add any console error that is not a `[probe]` line.

## Troubleshooting

- **No `[probe]` lines.** Check that you selected **SRGB Probe Classic** and restarted SignalRGB after copying it.
- **`alive` but no `start`.** The probe's main script failed. Send the `alive` and `window-error` lines and every other console error.
- **Canvas text but no console lines.** The console may be filtering messages; look for a level or text filter.
- **Lines look cut off.** The console's limit is below the probe's 3000-character chunks. Say so.
