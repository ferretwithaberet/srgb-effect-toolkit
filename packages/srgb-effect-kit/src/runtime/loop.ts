export interface LoopInfo {
  /** Seconds since the previous rendered frame (0 on the first frame after start). */
  dt: number;
  /** Seconds of rendered time since the first frame (paused spans excluded). */
  time: number;
  /** 1-based count of rendered frames. */
  frameCount: number;
}

export interface LoopOptions {
  /** Upper bound on rendered frames per second. Unset renders on every refresh.
   * Non-finite or non-positive values disable the cap. */
  maxFps?: number;
}

export interface Loop {
  start(): void;
  stop(): void;
  setMaxFps(maxFps: number | undefined): void;
  readonly running: boolean;
}

/** Refreshes this many ms early still count, to absorb rAF timestamp jitter. */
const JITTER_TOLERANCE_MS = 1;

/** Rounds to microseconds so float noise doesn't leak into dt/time. */
const round = (seconds: number) => Math.round(seconds * 1e6) / 1e6;

/** Non-finite or non-positive values disable the cap. */
const normalizeFps = (fps?: number) =>
  fps !== undefined && Number.isFinite(fps) && fps > 0 ? fps : undefined;

export function createLoop(frame: (info: LoopInfo) => void, options: LoopOptions = {}): Loop {
  let maxFps = normalizeFps(options.maxFps);
  let running = false;
  let rafId = 0;
  let frameCount = 0;
  let elapsed = 0; // unrounded seconds of rendered time, excluding paused spans
  let previousFrame: number | undefined; // previous rendered frame, for dt
  let anchor: number | undefined; // cadence anchor for the fps cap

  const tick = (timestamp: number) => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    if (maxFps !== undefined && anchor !== undefined) {
      const interval = 1000 / maxFps;
      const elapsed = timestamp - anchor;
      if (elapsed < interval - JITTER_TOLERANCE_MS) return;
      // Advance the anchor by whole intervals so the cadence doesn't drift with each refresh.
      const remainder = elapsed % interval;
      anchor = remainder > interval - JITTER_TOLERANCE_MS ? timestamp : timestamp - remainder;
    } else {
      anchor = timestamp;
    }

    const dt = previousFrame === undefined ? 0 : (timestamp - previousFrame) / 1000;
    previousFrame = timestamp;
    elapsed += dt;
    frameCount += 1;
    frame({ dt: round(dt), time: round(elapsed), frameCount });
  };

  return {
    start() {
      if (running) return;
      running = true;
      previousFrame = undefined;
      anchor = undefined;
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    setMaxFps(value) {
      maxFps = normalizeFps(value);
    },
    get running() {
      return running;
    },
  };
}
