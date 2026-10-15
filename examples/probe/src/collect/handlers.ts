import { guard, log, serialize } from '../log';
import { handlerName, propertyNames } from '../names';
import { now, readGlobal, state } from '../state';

const target = window as unknown as Record<string, unknown>;

/**
 * Assigns every `on<Prop>Changed` and `onCanvasApiEvent`, logging each call live as a `changed` or
 * `canvas-event` line. Plain functions, not arrows, so `this` shows how SignalRGB calls them.
 */
export function installHandlers(): void {
  let seq = 0;
  for (const name of propertyNames) {
    target[handlerName(name)] = function (this: unknown, ...args: unknown[]) {
      guard('changed', () => {
        const value = readGlobal(name);
        const record = serialize({
          property: name,
          seq: ++seq,
          t: now(),
          readyState: document.readyState,
          domContentLoaded: state.domContentLoaded,
          load: state.load,
          argsLength: args.length,
          args,
          thisIsWindow: this === window,
          thisType: typeof this,
          value,
          typeof: typeof value,
        });
        state.changed.push(record);
        log('changed', record);
      });
    };
  }

  let eventSeq = 0;
  target.onCanvasApiEvent = function (this: unknown, ...args: unknown[]) {
    guard('canvas-event', () => {
      const event = args[0];
      let keys: string[] | null;
      try {
        keys = event !== null && typeof event === 'object' ? Object.keys(event) : null;
      } catch {
        keys = null;
      }
      const record = serialize({
        seq: ++eventSeq,
        t: now(),
        argsLength: args.length,
        payload: event,
        typeof: typeof event,
        keys,
        thisIsWindow: this === window,
      });
      state.canvasEvents.push(record);
      log('canvas-event', record);
    });
  };
}

/** Logs `lifecycle {event, t}` for DOMContentLoaded and load. */
export function installLifecycle(): void {
  document.addEventListener('DOMContentLoaded', () => {
    state.domContentLoaded = true;
    log('lifecycle', { event: 'DOMContentLoaded', t: now(), readyState: document.readyState });
  });
  window.addEventListener('load', () => {
    state.load = true;
    log('lifecycle', { event: 'load', t: now(), readyState: document.readyState });
  });
}
