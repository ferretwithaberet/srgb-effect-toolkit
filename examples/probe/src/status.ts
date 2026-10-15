import { detectRenderer } from 'srgb-effect-kit';
import { guard } from './log';
import { now, state } from './state';

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)} s`;

/** Redraws a small status panel on the 320×200 canvas every second. Skipped without a 2D context. */
export function startStatus(): void {
  const canvas = document.querySelector('canvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  if (!canvas || !ctx) return;

  const draw = () =>
    guard('status', () => {
      const lines = [
        'SRGB Probe',
        `build: ${import.meta.env.PROBE_BUILD}`,
        `renderer: ${detectRenderer()}`,
        `rAF: ${state.hz === null ? 'measuring…' : `${state.hz.toFixed(1)} Hz`}`,
        state.reportAt === null ? 'report: pending' : `report logged at ${seconds(state.reportAt)}`,
        `changed: ${state.changed.length}  canvas-event: ${state.canvasEvents.length}`,
        `prop-change: ${state.propChangeCount}`,
        `t: ${seconds(now())}`,
      ];
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'top';
      ctx.font = '16px monospace';
      ctx.fillText(lines[0]!, 10, 10);
      ctx.font = '13px monospace';
      for (let i = 1; i < lines.length; i++) ctx.fillText(lines[i]!, 10, 22 + i * 22);
    });
  draw();
  setInterval(draw, 1000);
}
