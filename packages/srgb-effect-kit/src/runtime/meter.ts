export interface Meter {
  readonly value: number;
  /** Absolute change of the last accepted update. */
  readonly diff: number;
  readonly increased: boolean;
  readonly decreased: boolean;
  /** Feed one reading per frame, e.g. `meter.setValue(engine.vision.health)`. */
  setValue(value: number): void;
}

/**
 * Debounced screen-meter reader (typed port of the Meter class from SignalRGB's docs).
 * The callback fires only after `size` identical consecutive readings that differ from the current value.
 */
export function createMeter(size: number, callback: (meter: Meter) => void): Meter {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('[srgb-effect] createMeter: size must be a positive integer');
  }
  const readings: number[] = [];
  const state = { value: 0, diff: 0, increased: false, decreased: false };

  const meter: Meter = {
    get value() {
      return state.value;
    },
    get diff() {
      return state.diff;
    },
    get increased() {
      return state.increased;
    },
    get decreased() {
      return state.decreased;
    },
    setValue(reading) {
      readings.push(reading);
      if (readings.length > size) readings.shift();
      if (readings.length < size || readings.some((r) => r !== readings[0])) return;
      const stable = readings[0]!;
      if (stable === state.value) return;
      state.diff = Math.abs(stable - state.value);
      state.increased = stable > state.value;
      state.decreased = stable < state.value;
      state.value = stable;
      callback(meter);
    },
  };
  return meter;
}
