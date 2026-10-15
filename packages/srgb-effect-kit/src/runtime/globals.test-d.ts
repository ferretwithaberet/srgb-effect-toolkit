import type { CanvasApiEvent, SRGBBoolean, SRGBEngine } from './index';

// The SignalRGB globals are typed directly; no wrapper is needed.
export const level: number = engine.audio.level;
export const viaWindow: SRGBEngine = window.engine;
export const hue: number | undefined = globalThis.engine?.zone.hue[0];
export const vision: SRGBVision = engine.vision;
export const raw: SRGBBoolean = '1' satisfies globalThis.SRGBBoolean;
window.onCanvasApiEvent = (event: CanvasApiEvent) => void event.sender;

// prettier-ignore
// @ts-expect-error SRGBBoolean is '0' | '1'
export const notBoolean: SRGBBoolean = true;
