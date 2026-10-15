# SRGB Probe test plan

This is the protocol for running the probe effect in real SignalRGB and sending back what it records.

## Purpose

Several of the toolkit's defaults are educated guesses: the user agents `detectRenderer()` matches (`RENDERER_SIGNATURES`), the raw values of `boolean`, `color` and `list` properties, when and how SignalRGB calls `on<Prop>Changed`, the shape and value ranges of `engine`, whether meters are also bare globals, the frame rate at each FPS setting, the viewport, the JavaScript level (the build `target`), WebGL, Workers and `fetch`, the `onCanvasApiEvent` payload, and any globals SignalRGB injects that nobody documented. The probe records all of these inside SignalRGB, once per renderer, and logs them to SignalRGB's console. Your copied console lines replace the guesses with facts, and the toolkit's defaults, types and devtools simulation are then updated to match.

## Build and install

1. From the repository root, build the probe:

   ```sh
   pnpm --filter @srgb-effect-kit-examples/probe build
   ```

   This writes two files to `examples/probe/dist/`:
   - `probe.html`: the default build, with the effect code in a `<script type="module">`.
   - `probe-classic.html`: the same probe as a classic `<script>`, for comparison.

2. Copy both files into SignalRGB's effects folder:

   ```text
   C:\Users\<user>\AppData\Local\VortxEngine\app-<version>\Signal-x64\Effects\Dynamic\
   ```

3. Restart SignalRGB. It only picks up new effect files on start.
4. Both appear under **Installed** as **SRGB Probe** and **SRGB Probe Classic**.

The probe keeps its `console.log` calls (`dropConsole: false`), so unlike a normal effect it fills the console on purpose. Remove it when you are done.

## Where to read the console

Open SignalRGB's **Console** panel. Every probe message starts with `[probe]` and is a single line: `[probe] <section> <json>`. Copy every line that starts with `[probe]`, in order. If the Console panel won't let you copy, take screenshots instead and say so.

Long messages, such as `REPORT`, are split so the console can't truncate them: they arrive as `[probe] <section>#1/3 <chunk>`, `[probe] <section>#2/3 <chunk>` and so on. A chunked line is not valid JSON on its own; only all its chunks joined in order are. Copy every chunk.

The canvas also shows a small status panel (white text on black): the build (`module` or `classic`), `detectRenderer()`'s result, the measured frame rate once known, when the report was logged, and how many `changed` and `canvas-event` calls arrived. Use it to check the probe is alive, but send the console lines: they hold the data.

What to expect in the console, in order:

| Line                                                                          | When                                                                                                                                            |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `alive`                                                                       | First, from a small inline script, before the probe's code.                                                                                     |
| `window-error`                                                                | On any uncaught error or failed resource load.                                                                                                  |
| `start`                                                                       | Immediately.                                                                                                                                    |
| `env`                                                                         | Immediately: user agent, viewport, DPR, renderer.                                                                                               |
| `globals`                                                                     | Immediately: globals a clean window doesn't have.                                                                                               |
| `properties`                                                                  | Immediately: raw property values, handlers before assign.                                                                                       |
| `engine`, `meters`                                                            | Immediately: `engine`'s shape and the meter values.                                                                                             |
| `changed`                                                                     | On every `on<Prop>Changed` call, including load-time ones.                                                                                      |
| `lifecycle`                                                                   | On `DOMContentLoaded` and `load`.                                                                                                               |
| `canvas-event`                                                                | On every `onCanvasApiEvent` call.                                                                                                               |
| `features-syntax`, `features-builtins`, `features-canvas`, `features-storage` | Immediately: JavaScript syntax and built-ins, 2D canvas, localStorage.                                                                          |
| `timing`, `audio`, `zone`                                                     | At 5 s.                                                                                                                                         |
| `meters-live`, `engineUpdates`                                                | At 5 s: each meter's range over every frame, and how often the audio data actually changed.                                                     |
| `env@5s`, `engine@5s`, `meters@5s`, `properties@5s`                           | At 5 s: the same data again, in case SignalRGB fills it in after load.                                                                          |
| `features-webgl`, `features-worker`, `features-fetch`                         | Just after 5 s, one after another (the fetch takes up to about 3 s). They run last because they are the most likely to hang or crash an engine. |
| `REPORT`                                                                      | At 6 s, 36 s and 66 s: everything above in one message, usually chunked.                                                                        |
| `REPORT-delta`                                                                | Every 30 s after that, only when something is new: new `changed` and `canvas-event` records, and globals added since.                           |

A section that fails logs `[probe] <section>-error {"message":…,"stack":…}` instead; send those too.

Ignore one thing that looks like a finding: `handlersBefore` in `properties` and the seven `on…Changed`/`onCanvasApiEvent` names in `globals.injected` show `undefined` because the toolkit's own prelude creates them before the probe runs.

## Run checklist

Every run starts the same way: **select the effect, wait at least 8 s, then copy all `[probe]` lines.** If the run lists actions, do them first and copy at the end, so the copy includes their lines. Clear the console between runs if SignalRGB lets you, so each copy holds one run.

The renderer is chosen in SignalRGB's settings (the renderer option). The exact menu path isn't known yet, so please note where you found it. The FPS setting goes from 20 to 60.

| ID  | Renderer    | FPS | Effect file          | Audio         | Screen          | Actions after the first 8 s                                                                                                                                                                                                               |
| --- | ----------- | --- | -------------------- | ------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | UltraLight  | 60  | `probe.html`         | music playing | set up as below | Follow [the U1 and Q1 steps](#u1-and-q1-steps).                                                                                                                                                                                           |
| U2  | UltraLight  | 30  | `probe.html`         | any           | any             | Reselect the effect (or restart SignalRGB) after changing the FPS, then wait. Timing only.                                                                                                                                                |
| U3  | UltraLight  | 20  | `probe.html`         | any           | any             | As U2. Timing only.                                                                                                                                                                                                                       |
| U4  | UltraLight  | 60  | `probe.html`         | **silence**   | any             | No actions. Records the silent audio ranges.                                                                                                                                                                                              |
| U5  | UltraLight  | 60  | `probe-classic.html` | any           | any             | No actions. Checks the classic build runs; copy its lines.                                                                                                                                                                                |
| U6  | UltraLight  | 60  | `probe.html`         | any           | any             | Restart SignalRGB, then select `probe.html` as the first effect loaded after the restart. In `features-storage`, `previous` is what the last load wrote: if its `count`, `bootId` and `lastBoot` are there, storage survived the restart. |
| Q1  | QtWebEngine | 60  | `probe.html`         | music playing | set up as below | As U1.                                                                                                                                                                                                                                    |
| Q2  | QtWebEngine | 30  | `probe.html`         | any           | any             | As U2.                                                                                                                                                                                                                                    |
| Q3  | QtWebEngine | 20  | `probe.html`         | any           | any             | As U3.                                                                                                                                                                                                                                    |
| Q4  | QtWebEngine | 60  | `probe.html`         | **silence**   | any             | As U4.                                                                                                                                                                                                                                    |
| Q5  | QtWebEngine | 60  | `probe-classic.html` | any           | any             | As U5.                                                                                                                                                                                                                                    |
| Q6  | QtWebEngine | 60  | `probe.html`         | any           | any             | As U6.                                                                                                                                                                                                                                    |

### U1 and Q1 steps

These runs exercise the controls, the canvas API and the four screen meters. Positions are fractions of your main screen, measured from its top-left corner.

1. Before selecting the effect, arrange the screen so each meter has something to read:
   - **mArea** watches a box in the middle of the screen (from 40% to 60% across and down). Put a colourful, bright window over it, such as an image or a video.
   - **mLinear** watches a horizontal strip near the bottom left (90% down, from 5% to 25% across). If you can, put something bright green there.
   - **mText** watches the top middle (from 35% to 65% across, 5% to 15% down). Show the word `VICTORY` there in large text, for example in Notepad with a big font.
   - **mNumber** watches a small box at the bottom right (from 85% to 95% across, 90% to 95% down). Show a number such as `42` there in large text.
2. Start music, select the effect and wait at least 8 s. The meters are sampled during the first 5 s, so keep the screen still until then.
3. Change every control once, in this order: pNumber, pHue, pBool, pColor, pText (type 3 characters), pList.
4. In a Windows terminal (Command Prompt or PowerShell), send a canvas API event:

   ```text
   curl.exe -X POST "http://localhost:16034/canvas/event?sender=probe&event=hello"
   ```

   If `curl.exe` is missing, use PowerShell instead:

   ```powershell
   Invoke-WebRequest -Method Post -Uri "http://localhost:16034/canvas/event?sender=probe&event=hello"
   ```

   Expect a `[probe] canvas-event` line in the console.

5. Wait 35 s for the second `REPORT`, then copy all `[probe]` lines.

## What to send back

For each run, send one block like this:

```text
Run: U1
SignalRGB version: 2.x.y
Windows version: Windows 11 23H2 (once is enough)
GPU: model and driver version (once is enough)
SignalRGB preview/canvas size: as shown in SignalRGB, if it shows one
Renderer: UltraLight
FPS setting: 60
Audio: music playing (or: silence)
Screen: colourful window visible (or: desktop, game, …)
Renderer setting found at: Settings > … (once is enough)
Notes: anything odd you saw, such as a blank canvas

[probe] start {...}
[probe] env {...}
...
[probe] REPORT {...}

Other console errors (not [probe] lines):
...
```

Include every console error or warning that is not a `[probe]` line too, such as a script error that stopped the probe. Those matter as much as the data.

## Troubleshooting

- **No `[probe]` lines at all.** Check that the file you selected is the one you copied (the effect name is **SRGB Probe** or **SRGB Probe Classic**), and that SignalRGB was restarted after copying it.
- **`alive` but no `start`.** The probe's main script failed to parse or run. Send the `alive` line, any `window-error` lines and every other console error.
- **`probe.html` shows nothing, but `probe-classic.html` works.** That is an important result: it means the renderer can't run module scripts. Report it, with both runs' console output.
- **The canvas text appears, but no lines show in the console.** The console may be filtering messages. Look for a level or text filter, and describe what you see in the console.
- **Lines look cut off.** The probe splits anything longer than about 3000 characters into numbered chunks, so a cut-off line means the console's limit is lower. Say so; the individual section lines above `REPORT` hold the same data.

## What happens next

The findings go into `docs/probe-findings.md`, with the date, SignalRGB version and renderer. They then update the toolkit's defaults: the renderer signatures, the build `target` and `script` defaults, the raw types in the generated `.d.ts`, the `engine` types and ranges, and the devtools' simulation (user agents, load-time handler calls, viewport).
