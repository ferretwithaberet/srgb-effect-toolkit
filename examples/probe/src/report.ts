import { collectGlobals } from './collect/globals';
import { guard, logJson, sections, serialize, type Json } from './log';
import { now, state } from './state';

/** The REPORT line keeps the latest records; each was also logged live as its own line. */
const MAX_RECORDS = 64;

/** Logs `[probe] REPORT {...}`: every section so far plus the handler and event records. */
export function logReport(): void {
  guard('report', () => {
    state.reportAt = now();
    let globalsAtReport: Json;
    try {
      globalsAtReport = serialize(collectGlobals());
    } catch (error) {
      globalsAtReport = serialize({ error });
    }
    logJson('REPORT', {
      t: state.reportAt,
      sections,
      // Recomputed now, to catch globals injected after the script started.
      globalsAtReport,
      changedCount: state.changed.length,
      changed: state.changed.slice(-MAX_RECORDS),
      canvasEventCount: state.canvasEvents.length,
      canvasEvents: state.canvasEvents.slice(-MAX_RECORDS),
    });
  });
}
