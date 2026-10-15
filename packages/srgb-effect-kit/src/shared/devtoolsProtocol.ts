import type { EffectManifest } from './types';

/** Id of the virtual module the dev server injects to start the devtools. */
export const DEVTOOLS_MODULE_ID = 'virtual:srgb-effect/devtools';
/** Vite custom WebSocket event that carries canvas API events from the dev server to the page. */
export const CANVAS_EVENT = 'srgb-effect:canvas-event';
/** Dev-server path that mirrors SignalRGB's `POST /canvas/event?sender=…&event=…` endpoint. */
export const CANVAS_EVENT_PATH = '/canvas/event';

/** What the dev server passes to the devtools bootstrap. */
export interface DevtoolsConfig {
  manifest: EffectManifest;
  /** Call every on<Prop>Changed once at load, like SignalRGB does. */
  fireChangedOnLoad: boolean;
}
