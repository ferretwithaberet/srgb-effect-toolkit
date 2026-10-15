// SRGB Probe: records facts about SignalRGB's environment as one-line `[probe] <section> <json>`
// console messages. See TEST-PLAN.md for how to run it and what to send back.
import { createPropWatcher, snapshotProperties, type Seen } from './collect/propWatch';
import { createAudioRecorder } from './collect/audio';
import { collectEngine, collectMeters } from './collect/engine';
import { collectEnv, collectViewport } from './collect/env';
import { collectRiskyFeatures, collectSafeFeatures } from './collect/features';
import { collectGlobals } from './collect/globals';
import { installHandlers, installLifecycle } from './collect/handlers';
import { collectProperties, collectPropertyValues } from './collect/properties';
import { collectStart } from './collect/start';
import { createMeterRecorder } from './collect/metersLive';
import { createTimingRecorder } from './collect/timing';
import { collectZone } from './collect/zone';
import { everyFrame } from './frame';
import { guard, run, serialize } from './log';
import { startReports } from './report';
import { now, state } from './state';
import { startStatus } from './status';

/** How long timing and audio are measured, from the start. */
const MEASURE_MS = 5000;

// First, before anything else can touch the globals: the property watcher's baseline.
let initialProps: Record<string, Seen> | null = null;
try {
  initialProps = snapshotProperties();
} catch {
  // The watcher then starts from its first frame.
}
run('prop-watch-start', () => ({
  t: now(),
  readyState: document.readyState,
  initial: serialize(initialProps),
}));

state.startedAt = now();
run('start', collectStart);
run('env', collectEnv);
// Before the probe's own handlers exist, so the diff and handlersBefore show what was injected.
run('globals', collectGlobals);
run('properties', collectProperties);
guard('lifecycle', installLifecycle);
guard('handlers', installHandlers);
run('engine', collectEngine);
run('meters', collectMeters);

guard('features', collectSafeFeatures);

// For the page's lifetime: SignalRGB may rewrite property globals without calling a handler.
guard('prop-watch', () => {
  const watcher = createPropWatcher(initialProps || {});
  everyFrame('prop-watch', () => watcher.frame());
});

// Timing, audio and meters: sampled on every animation frame for MEASURE_MS. A timer, not rAF, ends the
// window, so the sections are logged even if rAF never fires.
guard('timing', () => {
  const timing = createTimingRecorder();
  const audio = createAudioRecorder();
  const meters = createMeterRecorder();
  let measuring = true;
  const frame = (timestamp: unknown) => {
    if (!measuring) return;
    guard('timing', () => timing.frame(timestamp));
    guard('audio', () => audio.sample());
    guard('meters-live', () => meters.sample());
    requestAnimationFrame(frame);
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
  setTimeout(() => {
    measuring = false;
    run('timing', () => {
      const result = timing.result();
      state.hz = result.raf.hz !== null ? result.raf.hz : result.raf.nowHz;
      return result;
    });
    run('audio', () => audio.result());
    run('engineUpdates', () => audio.updates());
    run('meters-live', () => meters.result());
    run('zone', collectZone);
    // Late snapshots: SignalRGB may fill engine, meters, properties or the viewport after load.
    run('env@5s', collectViewport);
    run('engine@5s', collectEngine);
    run('meters@5s', collectMeters);
    run('properties@5s', collectPropertyValues);
    // Last: WebGL, Worker and fetch can hang or crash a fragile engine.
    guard('features', () => void collectRiskyFeatures());
  }, MEASURE_MS);
});

guard('report', startReports);

guard('status', startStatus);
