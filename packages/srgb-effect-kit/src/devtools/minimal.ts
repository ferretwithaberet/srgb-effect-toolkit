import type { DevtoolsConfig } from '../shared';
import type { SimulationContext, StartOptions } from './context';
import { findInstance, rememberInstance, startSimulation } from './simulation';
import { NO_STORAGE } from './storage';

export type { SimulationContext, StartOptions } from './context';

/**
 * Entry for `devtools: 'minimal'`: SignalRGB's environment and nothing visible. Property globals
 * always start from the manifest defaults (nothing is persisted, as nothing can change them), the
 * renderer stays the browser's, and no drawer, marker or console counter is loaded.
 */
export function startDevtools(
  config: DevtoolsConfig,
  options: StartOptions = {},
): SimulationContext {
  const { hot, win = window } = options;
  const existing = findInstance(win);
  if (existing) return existing;
  const context = startSimulation(config, win, NO_STORAGE, hot);
  rememberInstance(win, context);
  return context;
}
