import type { DevtoolsConfig, EffectManifest } from '../../src/shared';

/** One property of every type and one meter of every type. */
export const MANIFEST = {
  title: 'Devtools Test',
  properties: [
    { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
    { property: 'baseHue', type: 'hue', label: 'Hue', default: 120 },
    { property: 'rainbow', type: 'boolean', label: 'Rainbow', default: true },
    { property: 'tint', type: 'color', label: 'Tint', default: '#009bde' },
    { property: 'text', type: 'textfield', label: 'Text', default: '' },
    { property: 'mode', type: 'list', label: 'Mode', values: ['Wave', 'Pulse'], default: 'Wave' },
  ],
  meters: [
    {
      meter: 'health',
      type: 'linear',
      x: 0.1,
      y: 0.5,
      width: 0.5,
      h: [100, 140],
      s: [50, 100],
      l: [25, 75],
    },
    {
      meter: 'mana',
      type: 'area',
      x: 0,
      y: 0,
      width: 0.5,
      height: 0.5,
      h: [200, 260],
      s: [50, 100],
      l: [25, 75],
      resolutions: [{ size: '1920x1080', x: 0.5 }],
    },
    {
      meter: 'victory',
      type: 'ocr_textmatch',
      x: 0,
      y: 0,
      width: 0.2,
      height: 0.1,
      string: 'VICTORY',
    },
    { meter: 'score', type: 'ocr_numeric', x: 0, y: 0, width: 0.2, height: 0.1 },
  ],
} as const satisfies EffectManifest;

export const CONFIG: DevtoolsConfig = { manifest: MANIFEST, fireChangedOnLoad: true };

/** Globals the devtools define for MANIFEST. */
export const GLOBAL_NAMES = [
  ...MANIFEST.properties.map((p) => p.property),
  'onSpeedChanged',
  'onBaseHueChanged',
  'onRainbowChanged',
  'onTintChanged',
  'onTextChanged',
  'onModeChanged',
  'onCanvasApiEvent',
  'engine',
];

/** Undoes everything `startDevtools()` did to the jsdom window, so each test starts clean. */
export function resetDevtoolsWindow(): void {
  const globals = window as unknown as Record<PropertyKey, unknown>;
  for (const name of GLOBAL_NAMES) delete globals[name];
  // Flush DOM-ready listeners left by earlier tests (they are `once`); no handler exists now.
  document.dispatchEvent(new Event('DOMContentLoaded'));
  delete globals[Symbol.for('srgb-effect-kit.devtools')];
  localStorage.clear();
  document.body.replaceChildren();
  for (const host of document.querySelectorAll('srgb-effect-devtools')) host.remove();
}

/** Pretends the document is still parsing, as it is while module scripts run in a browser. */
export function setReadyState(state: DocumentReadyState): void {
  Object.defineProperty(document, 'readyState', { configurable: true, get: () => state });
}

/** Restores jsdom's own `readyState` ('complete'). */
export function restoreReadyState(): void {
  delete (document as unknown as Record<string, unknown>).readyState;
}
