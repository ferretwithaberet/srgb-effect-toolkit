import type { Engine } from './types';

/** The `engine` global SignalRGB injects, or undefined outside SignalRGB (and before devtools mocks it). */
export const getEngine = (): Partial<Engine> | undefined =>
  (globalThis as { engine?: Partial<Engine> }).engine;
