import { collectGlobals } from './collect/globals';
import { guard, logJson, sections, serialize, type Json } from './log';
import { now, state } from './state';

const FIRST_REPORT_MS = 6000;
const REPORT_EVERY_MS = 30000;
/** Full REPORT lines (about 6 s, 36 s and 66 s); after that only REPORT-delta lines. */
const FULL_REPORTS = 3;
/** The REPORT line keeps the latest records; each was also logged live as its own line. */
const MAX_RECORDS = 64;

let fullReports = 0;
/** How many changed / canvas-event records earlier REPORT lines covered. */
let changedSeen = 0;
let eventsSeen = 0;
/** The injected globals the last REPORT saw, for the late-globals diff. */
let lastGlobals: Record<string, string> | null = null;

function injectedGlobals(): Record<string, string> | null {
  try {
    return collectGlobals().injected;
  } catch {
    return null;
  }
}

/** Globals added, removed or changed in type since `before`. */
function globalsDiff(before: Record<string, string> | null, after: Record<string, string> | null) {
  const added: Record<string, string> = {};
  const removed: string[] = [];
  const retyped: Record<string, string> = {};
  if (!before || !after) return { added, removed, retyped };
  for (const name of Object.keys(after)) {
    if (!(name in before)) added[name] = after[name]!;
    else if (before[name] !== after[name]) retyped[name] = `${before[name]} -> ${after[name]}`;
  }
  for (const name of Object.keys(before)) if (!(name in after)) removed.push(name);
  return { added, removed, retyped };
}

/** Logs `[probe] REPORT {...}`: every section so far plus the handler and event records. */
function logReport(): void {
  state.reportAt = now();
  fullReports++;
  let globalsAtReport: Json;
  try {
    const globals = collectGlobals();
    lastGlobals = globals.injected;
    globalsAtReport = serialize(globals);
  } catch (error) {
    globalsAtReport = serialize({ error });
  }
  changedSeen = state.changed.length;
  eventsSeen = state.canvasEvents.length;
  logJson('REPORT', {
    t: state.reportAt,
    n: fullReports,
    sections,
    // Recomputed now, to catch globals injected after the script started.
    globalsAtReport,
    changedCount: state.changed.length,
    changed: state.changed.slice(-MAX_RECORDS),
    canvasEventCount: state.canvasEvents.length,
    canvasEvents: state.canvasEvents.slice(-MAX_RECORDS),
  });
}

/** Logs `[probe] REPORT-delta {...}` with what is new since the last line, if anything. */
function logDelta(): void {
  const globals = injectedGlobals();
  const diff = globalsDiff(lastGlobals, globals);
  if (globals) lastGlobals = globals;
  const changed = state.changed.slice(changedSeen);
  const events = state.canvasEvents.slice(eventsSeen);
  changedSeen = state.changed.length;
  eventsSeen = state.canvasEvents.length;
  const quiet =
    changed.length === 0 &&
    events.length === 0 &&
    Object.keys(diff.added).length === 0 &&
    diff.removed.length === 0 &&
    Object.keys(diff.retyped).length === 0;
  if (quiet) return;
  logJson('REPORT-delta', {
    t: now(),
    changed: changed.slice(-MAX_RECORDS),
    canvasEvents: events.slice(-MAX_RECORDS),
    globals: serialize(diff),
  });
}

/** Schedules the REPORT lines: full ones first, then deltas. */
export function startReports(): void {
  setTimeout(() => {
    guard('report', logReport);
    setInterval(
      () => guard('report', fullReports < FULL_REPORTS ? logReport : logDelta),
      REPORT_EVERY_MS,
    );
  }, FIRST_REPORT_MS);
}
