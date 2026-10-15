import type { DevtoolsConfig } from '../shared';
import type { CanvasApiController } from './canvasApi';
import type { ConsoleCounter } from './consoleCounter';
import type { MockEngine } from './engine';
import type { PropertyController } from './properties';
import type { RendererController } from './renderer';
import type { DevtoolsStorage } from './storage';

/** The effect page's window. */
export type DevtoolsWindow = Window & typeof globalThis;

/** `requestAnimationFrame`/`cancelAnimationFrame`, captured before any renderer simulation patches them. */
export interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

/** The part of Vite's `import.meta.hot` the devtools use. */
export interface HotBridge {
  on(event: string, listener: (data: unknown) => void): void;
}

/** Options for `startDevtools()`, in both entries. */
export interface StartOptions {
  /** Vite's `import.meta.hot`, for events from the dev server. */
  hot?: HotBridge;
  /** The effect page's window. @default window */
  win?: DevtoolsWindow;
}

/** The SignalRGB environment: what both the `minimal` and the `full` mode provide. */
export interface SimulationContext {
  readonly config: DevtoolsConfig;
  readonly win: DevtoolsWindow;
  readonly properties: PropertyController;
  readonly engine: MockEngine;
  readonly canvasApi: CanvasApiController;
}

/** Everything the `full` bootstrap creates; the drawer's tabs read and drive it. */
export interface DevtoolsContext extends SimulationContext {
  readonly storage: DevtoolsStorage;
  /** The page's native rAF, unaffected by the UltraLight simulation. */
  readonly raf: FrameScheduler;
  readonly renderer: RendererController;
  readonly consoleCounter: ConsoleCounter;
}

/** The window as a bag of globals, for names only known at runtime (property globals, handlers). */
export const globalsOf = (win: DevtoolsWindow): Record<string, unknown> =>
  win as unknown as Record<string, unknown>;
