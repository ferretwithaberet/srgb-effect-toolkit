/** All devtools CSS. It lives in a string so it can be placed inside the shadow root. */
export const DEVTOOLS_CSS = `
:host {
  all: initial;
  color-scheme: dark;
  font: 12px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: #e6e6e6;
}
*, *::before, *::after { box-sizing: border-box; }
[hidden] { display: none !important; }
button, input, select { font: inherit; color: inherit; }

.area { position: absolute; inset: 0; pointer-events: none; }
.area-line { position: absolute; background: #ff1744; }
.area-dim { position: absolute; background: rgb(0 0 0 / 0.6); }

.toggle {
  position: absolute; right: 12px; bottom: 12px; pointer-events: auto;
  display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px;
  border: 1px solid #3a3f4b; border-radius: 999px; background: #16181d; cursor: pointer;
  font-weight: 600; box-shadow: 0 2px 8px rgb(0 0 0 / 0.4);
}
.badge {
  min-width: 18px; padding: 0 5px; border-radius: 9px; background: #f5a623; color: #16181d;
  font-size: 11px; text-align: center;
}

.panel {
  position: absolute; pointer-events: auto; display: flex; flex-direction: column;
  background: #16181d; box-shadow: 0 0 16px rgb(0 0 0 / 0.5);
}
.panel[data-dock='bottom'] { left: 0; right: 0; bottom: 0; height: var(--size); border-top: 1px solid #3a3f4b; }
.panel[data-dock='right'] { top: 0; right: 0; bottom: 0; width: var(--size); border-left: 1px solid #3a3f4b; }
.resize { position: absolute; z-index: 1; }
.panel[data-dock='bottom'] .resize { left: 0; right: 0; top: -3px; height: 6px; cursor: ns-resize; }
.panel[data-dock='right'] .resize { top: 0; bottom: 0; left: -3px; width: 6px; cursor: ew-resize; }
.header { display: flex; align-items: center; gap: 8px; padding: 0 8px; border-bottom: 1px solid #3a3f4b; }
.tabs { display: flex; flex: 1; overflow-x: auto; }
.panel[data-dock='right'] .header { flex-wrap: wrap; padding-top: 6px; }
.panel[data-dock='right'] .tools { margin-left: auto; }
.panel[data-dock='right'] .tabs { order: 1; flex-basis: 100%; }
.tab { padding: 8px 10px; border: 0; border-bottom: 2px solid transparent; background: none; cursor: pointer; white-space: nowrap; }
.tab[aria-selected='true'] { border-bottom-color: #4c8dff; color: #fff; }
.tools { display: flex; gap: 4px; }
.tool, .button {
  padding: 3px 8px; border: 1px solid #3a3f4b; border-radius: 4px; background: #20232a; cursor: pointer;
}
.tool[aria-pressed='true'], .segmented [aria-pressed='true'] { background: #4c8dff; border-color: #4c8dff; color: #fff; }
.button:disabled { opacity: 0.5; cursor: default; }
.content { flex: 1; overflow: auto; padding: 12px; }

.rows { display: grid; gap: 8px; }
.row { display: grid; grid-template-columns: minmax(110px, 30%) minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.row > label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row > input[type='checkbox'], .row > input[type='color'] { justify-self: start; }
.value { min-width: 5ch; text-align: right; font-variant-numeric: tabular-nums; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.note { margin: 8px 0 0; color: #9aa0a6; }
.error { color: #ff6b6b; }
.segmented { display: inline-flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
.segmented button { padding: 3px 8px; border: 1px solid #3a3f4b; border-radius: 4px; background: #20232a; cursor: pointer; }
input[type='text'], input[type='number'], select {
  min-width: 0; padding: 3px 6px; border: 1px solid #3a3f4b; border-radius: 4px; background: #0f1115;
}
input[type='range'] { width: 100%; }
input[type='range'].hue {
  appearance: none; height: 8px; border-radius: 4px; background: var(--track);
}
input[type='range'].hue::-webkit-slider-thumb {
  appearance: none; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; background: transparent;
}
input[type='color'] { width: 48px; height: 24px; padding: 0; border: 1px solid #3a3f4b; background: none; }
.bar { height: 8px; border-radius: 4px; background: #20232a; overflow: hidden; }
.bar > span { display: block; height: 100%; background: #4c8dff; }
canvas.preview { display: block; max-width: 100%; border: 1px solid #3a3f4b; image-rendering: pixelated; }
.log { margin: 8px 0 0; padding: 0; list-style: none; font-family: ui-monospace, monospace; }
.log li { padding: 2px 0; border-bottom: 1px solid #20232a; }
code { font-family: ui-monospace, monospace; }
`;
