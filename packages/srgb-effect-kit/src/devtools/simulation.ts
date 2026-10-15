import { CANVAS_EVENT, handlerGlobalNames, type DevtoolsConfig } from '../shared';
import { createCanvasApi, toCanvasApiEvent } from './canvasApi';
import { globalsOf, type DevtoolsWindow, type HotBridge, type SimulationContext } from './context';
import { createEngineMock } from './engine';
import { onDomReady } from './lifecycle';
import { createPropertyController } from './properties';
import type { DevtoolsStorage } from './storage';

const INSTANCE = Symbol.for('srgb-effect-kit.devtools');

/** The context a previous `startDevtools()` stored on this window, if any. */
export const findInstance = <T extends SimulationContext>(win: DevtoolsWindow): T | undefined =>
  (win as unknown as Record<symbol, T | undefined>)[INSTANCE];

/** Remembers the context so a second start (e.g. a re-executed module) reuses it. */
export function rememberInstance(win: DevtoolsWindow, context: SimulationContext): void {
  (win as unknown as Record<symbol, SimulationContext>)[INSTANCE] = context;
}

/**
 * Sets up SignalRGB's environment, synchronously: the handler globals (the build's prelude
 * guarantee), the property globals (from `storage`, else the defaults), the `engine` mock and the
 * canvas-event relay. On DOM ready, calls every `on<Prop>Changed` when `fireChangedOnLoad` is set.
 */
export function startSimulation(
  config: DevtoolsConfig,
  win: DevtoolsWindow,
  storage: DevtoolsStorage,
  hot?: HotBridge,
): SimulationContext {
  const globals = globalsOf(win);
  // Bare `onSpeedChanged = …` must not throw in strict code.
  for (const name of handlerGlobalNames(config.manifest)) {
    if (!(name in win)) globals[name] = undefined;
  }
  const properties = createPropertyController(config.manifest.properties ?? [], storage, win);
  const engine = createEngineMock(config.manifest.meters);
  globals.engine = engine;
  const canvasApi = createCanvasApi(win);

  // `POST /canvas/event` on the dev server arrives over Vite's WebSocket.
  hot?.on(CANVAS_EVENT, (data) => {
    const event = toCanvasApiEvent(data);
    if (event) canvasApi.dispatch(event, 'http');
  });
  // DOMContentLoaded fires after every module script ran, so effect code has assigned its handlers.
  onDomReady(win, () => {
    if (config.fireChangedOnLoad) properties.fireAll();
  });
  return { config, win, properties, engine, canvasApi };
}
