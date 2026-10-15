import { describe } from '../describe';
import { attempt, Raw } from '../log';
import { meterNames } from '../names';
import { readGlobal } from '../state';

/** `engine`, or undefined when SignalRGB (or the devtools) did not inject it. */
export const getEngine = (): Record<string, unknown> | undefined => {
  const engine = readGlobal('engine');
  return engine !== null && typeof engine === 'object'
    ? (engine as Record<string, unknown>)
    : undefined;
};

/** The deep shape of `engine`. */
export const collectEngine = () => ({
  typeof: typeof readGlobal('engine'),
  ownProperty: Object.prototype.hasOwnProperty.call(window, 'engine'),
  inWindow: 'engine' in window,
  // Raw: describe() already bounds its own depth, which is deeper than the log's.
  shape: new Raw(describe(readGlobal('engine'))),
});

/** Each meter on `engine.vision`, and whether it is also a bare global. */
export const collectMeters = () => {
  const engine = getEngine();
  const vision = engine
    ? (attempt(() => engine.vision) as Record<string, unknown> | undefined)
    : undefined;
  const result: Record<string, unknown> = {};
  for (const name of meterNames) {
    const value = vision && typeof vision === 'object' ? attempt(() => vision[name]) : undefined;
    const inWindow = name in window;
    result[name] = {
      vision: value,
      visionTypeof: typeof value,
      globalTypeof: typeof readGlobal(name),
      inWindow,
      global: inWindow ? readGlobal(name) : null,
    };
  }
  return { visionTypeof: typeof vision, meters: result };
};
