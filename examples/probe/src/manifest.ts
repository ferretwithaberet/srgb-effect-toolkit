// Shared by vite.config.ts (module build) and vite.config.classic.ts (classic build), and read at
// runtime for the property and meter names. Only type imports from the plugin, so nothing of it
// reaches the effect bundle.
import type { MeterDef, PropertyDef } from 'srgb-effect-kit/vite';

/** One property of every control type. */
export const properties = [
  { property: 'pNumber', type: 'number', label: 'Number', min: 0, max: 100, default: 50 },
  { property: 'pHue', type: 'hue', label: 'Hue', default: 200 },
  // A second hue, to check whether every hue default arrives as 0 (pHue's 200 did).
  { property: 'pHue2', type: 'hue', label: 'Hue 2', default: 120 },
  { property: 'pBool', type: 'boolean', label: 'Boolean', default: true },
  { property: 'pColor', type: 'color', label: 'Color', default: '#009bde' },
  { property: 'pText', type: 'textfield', label: 'Text', default: 'probe' },
  {
    property: 'pList',
    type: 'list',
    label: 'List',
    values: ['Alpha', 'Beta', 'Gamma'],
    default: 'Beta',
  },
] as const satisfies readonly PropertyDef[];

/**
 * SignalRGB ignores a meter without tags ("No tags specified for <meter>"). Edge is open in the
 * test VM, so the meters target it (and VLC).
 */
const tags = ['msedge', 'vlc'];

/** One meter of every type, all well inside the screen. */
export const meters = [
  {
    meter: 'mLinear',
    type: 'linear',
    tags,
    x: 0.05,
    y: 0.9,
    width: 0.2,
    h: [70, 140],
    s: [40, 100],
    l: [40, 100],
  },
  {
    meter: 'mArea',
    type: 'area',
    tags,
    x: 0.4,
    y: 0.4,
    width: 0.2,
    height: 0.2,
    h: [0, 360],
    s: [0, 100],
    l: [50, 100],
  },
  {
    meter: 'mText',
    type: 'ocr_textmatch',
    tags,
    x: 0.35,
    y: 0.05,
    width: 0.3,
    height: 0.1,
    string: 'VICTORY',
  },
  {
    meter: 'mNumber',
    type: 'ocr_numeric',
    tags,
    x: 0.85,
    y: 0.9,
    width: 0.1,
    height: 0.05,
  },
] as const satisfies readonly MeterDef[];

/** Options both builds share; each config adds its own title, file name and script mode. */
export const sharedOptions = {
  description: 'Logs facts about the SignalRGB environment to the console as [probe] lines',
  publisher: 'srgb-effect-kit',
  properties,
  meters,
  // Critical: the default (true) strips every console.log, which is the probe's only output.
  dropConsole: false,
  // The probe must run on engines older than the toolkit's es2020 default, because finding the
  // engines' JavaScript level is one of its jobs. Its feature checks use new Function, which the
  // build does not transpile.
  target: 'es2015',
} as const;
