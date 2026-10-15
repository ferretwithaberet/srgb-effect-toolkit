export { parseBoolean } from './boolean';
export { RENDERER_SIGNATURES, detectRenderer, isSignalRGB } from './renderer';
export type { Renderer } from './renderer';
// Also brings the `declare global` block (engine, onCanvasApiEvent, SRGBVision) into the d.ts.
export type { CanvasApiEvent, EngineAudio, EngineZone, SRGBBoolean, SRGBEngine } from './globals';
export {
  hexToHsl,
  hexToRgb,
  hsl,
  hslToHex,
  hslToRgb,
  lerpColor,
  rgb,
  rgbToHex,
  rgbToHsl,
} from './color';
export type { Hsl, Rgb } from './color';
export { createLoop } from './loop';
export type { Loop, LoopInfo, LoopOptions } from './loop';
export { FREQUENCY_BINS, SILENCE_SUM_THRESHOLD, getFrequencies, isSilent } from './audio';
export { createMeter } from './meter';
export type { Meter } from './meter';
export { ZONE_COLUMNS, ZONE_ROWS, getZone, getZones } from './zones';
export type { ZoneColor } from './zones';
