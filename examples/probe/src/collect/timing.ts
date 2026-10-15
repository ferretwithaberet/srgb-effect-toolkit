import { now } from '../state';

/** Records rAF callbacks and a 100 ms setInterval; `result()` summarises them. */
export function createTimingRecorder() {
  let count = 0;
  let first: { timestamp: unknown; now: number } | null = null;
  let previous: number | null = null;
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  let intervals = 0;
  let monotonic = true;
  let timestampType: string | null = null;

  const intervalStart = now();
  let intervalTicks = 0;
  const intervalId = setInterval(() => {
    intervalTicks++;
  }, 100);

  return {
    /** Call from each rAF callback with its timestamp argument. */
    frame(timestamp: unknown): void {
      count++;
      if (!first) {
        first = { timestamp, now: now() };
        timestampType = typeof timestamp;
      }
      if (typeof timestamp !== 'number') return;
      if (previous !== null) {
        const interval = timestamp - previous;
        if (interval <= 0) monotonic = false;
        min = Math.min(min, interval);
        max = Math.max(max, interval);
        sum += interval;
        intervals++;
      }
      previous = timestamp;
    },
    result() {
      clearInterval(intervalId);
      const average = intervals > 0 ? sum / intervals : null;
      const elapsed = now() - intervalStart;
      return {
        windowMs: elapsed,
        raf: {
          count,
          averageMs: average,
          minMs: intervals > 0 ? min : null,
          maxMs: intervals > 0 ? max : null,
          // From the average interval; callbacks per second over the window as a cross-check.
          hz: average ? 1000 / average : null,
          callbacksPerSecond: count / (elapsed / 1000),
          timestampType,
          monotonic,
          first,
        },
        setInterval100: {
          ticks: intervalTicks,
          averageMs: intervalTicks > 0 ? elapsed / intervalTicks : null,
        },
      };
    },
  };
}
