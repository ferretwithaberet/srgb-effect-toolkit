import type { SRGBEngine } from './globals';

/**
 * The `engine` global, or undefined when SignalRGB (or the devtools) did not inject it. Read
 * through the bare identifier, as SignalRGB's own examples do: that also finds an `engine`
 * declared with `let` or `const` in a classic script, which `globalThis.engine` misses.
 */
export const getEngine = (): SRGBEngine | undefined =>
  typeof engine === 'undefined' ? undefined : engine;
