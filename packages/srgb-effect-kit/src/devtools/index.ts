import type { DevtoolsConfig } from '../shared';
import type { DevtoolsContext, FrameScheduler, StartOptions } from './context';
import { installConsoleCounter } from './consoleCounter';
import { installRendererSimulation } from './renderer';
import { findInstance, rememberInstance, startSimulation } from './simulation';
import { createStorage } from './storage';

export type { DevtoolsContext, StartOptions } from './context';

/**
 * Entry for `devtools: 'full'` (the default). The plugin's virtual module imports and calls it
 * from a module script that runs before the effect's own scripts. Everything before the DOM-ready
 * callbacks runs synchronously, so the effect's top-level code already sees SignalRGB's globals.
 */
export function startDevtools(config: DevtoolsConfig, options: StartOptions = {}): DevtoolsContext {
  const { hot, win = window } = options;
  const existing = findInstance<DevtoolsContext>(win);
  if (existing) return existing;

  const storage = createStorage(config.manifest.title, () => win.localStorage);
  const raf: FrameScheduler = {
    request: win.requestAnimationFrame.bind(win),
    cancel: win.cancelAnimationFrame.bind(win),
  };
  // Before effect code runs: it may read the user agent or start its loop at the top level.
  const renderer = installRendererSimulation(win, storage, raf);
  const consoleCounter = installConsoleCounter(win);
  const simulation = startSimulation(config, win, storage, hot);

  const context: DevtoolsContext = {
    ...simulation,
    storage,
    raf,
    renderer,
    consoleCounter,
  };
  rememberInstance(win, context);
  return context;
}
