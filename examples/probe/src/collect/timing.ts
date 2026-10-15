import { stats } from '../stats';
import { now } from '../state';

/**
 * Records rAF callbacks and a 100 ms setInterval; `result()` summarises them. Intervals come both
 * from rAF's timestamp argument and from `performance.now()` deltas, so the rate survives an
 * engine that passes no timestamp.
 */
export function createTimingRecorder() {
  const start = now();
  let count = 0;
  let first: { timestamp: unknown; now: number } | null = null;
  let timestampType: string | null = null;
  let monotonic = true;
  let previousTimestamp: number | null = null;
  let previousNow: number | null = null;
  const intervals: number[] = [];
  const nowIntervals: number[] = [];

  let intervalTicks = 0;
  const intervalId = setInterval(() => {
    intervalTicks++;
  }, 100);

  return {
    /** Call from each rAF callback with its timestamp argument. */
    frame(timestamp: unknown): void {
      const t = now();
      count++;
      if (!first) {
        first = { timestamp, now: t };
        timestampType = typeof timestamp;
      }
      if (previousNow !== null) nowIntervals.push(t - previousNow);
      previousNow = t;
      if (typeof timestamp !== 'number') return;
      if (previousTimestamp !== null) {
        const interval = timestamp - previousTimestamp;
        if (interval <= 0) monotonic = false;
        intervals.push(interval);
      }
      previousTimestamp = timestamp;
    },
    result() {
      clearInterval(intervalId);
      const elapsed = now() - start;
      const fromTimestamps = stats(intervals);
      const fromNow = stats(nowIntervals);
      return {
        windowMs: elapsed,
        typeofRequestAnimationFrame: typeof requestAnimationFrame,
        visibilityState: document.visibilityState,
        raf: {
          count,
          callbacksPerSecond: count / (elapsed / 1000),
          timestampType,
          monotonic,
          first,
          // From rAF's timestamp argument.
          intervals: fromTimestamps,
          hz: fromTimestamps.avg ? 1000 / fromTimestamps.avg : null,
          // From performance.now() inside each callback.
          nowIntervals: fromNow,
          nowHz: fromNow.avg ? 1000 / fromNow.avg : null,
        },
        setInterval100: {
          ticks: intervalTicks,
          averageMs: intervalTicks > 0 ? elapsed / intervalTicks : null,
        },
      };
    },
  };
}
