import { attempt, log, logJson, serialize } from '../log';
import { propertyNames } from '../names';
import { now, readGlobal, state } from '../state';

/** A property global as last seen. */
export interface Seen {
  value: unknown;
  typeof: string;
}

/** Changes logged live; later ones are only counted, in case a global flips every frame. */
const MAX_LIVE = 300;

function read(name: string): Seen {
  const value = attempt(() => readGlobal(name));
  // A throwing getter gives a fresh object on every read; a string compares equal across frames.
  if (value !== null && typeof value === 'object' && 'throws' in value) {
    return { value: `[throws: ${String(value.throws)}]`, typeof: 'throws' };
  }
  return { value, typeof: typeof value };
}

/** Every property global's value and `typeof`, read now. */
export function snapshotProperties(): Record<string, Seen> {
  const seen: Record<string, Seen> = {};
  for (const name of propertyNames) seen[name] = read(name);
  return seen;
}

/**
 * Compares every property global with its last seen value and `typeof` once per frame and logs
 * each difference as a `prop-change` line. `handlerCalledSinceLast` says whether the probe's
 * `on<Prop>Changed` for that property ran since the previous frame, which tells a handler-driven
 * change from a silent rewrite.
 */
export function createPropWatcher(initial: Record<string, Seen>) {
  const last: Record<string, Seen> = { ...initial };
  let capped = false;
  return {
    frame(): void {
      for (const name of propertyNames) {
        const current = read(name);
        const previous = last[name];
        const called = state.handlerCalled[name] === true;
        state.handlerCalled[name] = false;
        if (
          previous &&
          Object.is(previous.value, current.value) &&
          previous.typeof === current.typeof
        ) {
          continue;
        }
        last[name] = current;
        state.propChangeCount++;
        if (state.propChanges.length >= MAX_LIVE) {
          if (!capped) log('prop-change-capped', { t: now(), after: MAX_LIVE });
          capped = true;
          continue;
        }
        const record = serialize({
          property: name,
          t: now(),
          readyState: document.readyState,
          from: previous ?? null,
          to: current,
          handlerCalledSinceLast: called,
        });
        state.propChanges.push(record);
        logJson('prop-change', record);
      }
    },
  };
}
