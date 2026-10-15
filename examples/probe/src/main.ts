// SRGB Probe: records facts about SignalRGB's environment as one-line `[probe] <section> <json>`
// console messages. See TEST-PLAN.md for how to run it and what to send back.
import { createAudioRecorder } from './collect/audio';
import { collectEngine, collectMeters } from './collect/engine';
import { collectEnv, collectViewport } from './collect/env';
import { collectFeatures } from './collect/features';
import { collectGlobals } from './collect/globals';
import { installHandlers, installLifecycle } from './collect/handlers';
import { collectProperties, collectPropertyValues } from './collect/properties';
import { collectStart } from './collect/start';
import { createTimingRecorder } from './collect/timing';
import { collectZone } from './collect/zone';
import { guard, logError, logSection, run } from './log';
import { startReports } from './report';
import { now, state } from './state';
import { startStatus } from './status';

/** How long timing and audio are measured, from the start. */
const MEASURE_MS = 5000;

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

try {
  collectFeatures().then(
    (features) => logSection('features', features),
    (error: unknown) => logError('features', error),
  );
} catch (error) {
  logError('features', error);
}

// Timing and audio: sampled on every animation frame for MEASURE_MS. A timer, not rAF, ends the
// window, so the sections are logged even if rAF never fires.
guard('timing', () => {
  const timing = createTimingRecorder();
  const audio = createAudioRecorder();
  let measuring = true;
  const frame = (timestamp: unknown) => {
    if (!measuring) return;
    guard('timing', () => timing.frame(timestamp));
    guard('audio', () => audio.sample());
    requestAnimationFrame(frame);
  };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(frame);
  setTimeout(() => {
    measuring = false;
    run('timing', () => {
      const result = timing.result();
      state.hz = result.raf.hz;
      return result;
    });
    run('audio', () => audio.result());
    run('zone', collectZone);
    // Late snapshots: SignalRGB may fill engine, meters, properties or the viewport after load.
    run('env@5s', collectViewport);
    run('engine@5s', collectEngine);
    run('meters@5s', collectMeters);
    run('properties@5s', collectPropertyValues);
  }, MEASURE_MS);
});

guard('report', startReports);

guard('status', startStatus);
