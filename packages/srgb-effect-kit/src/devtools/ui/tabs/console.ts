import { COUNTED_METHODS, type ConsoleCounts } from '../../consoleCounter';
import type { DevtoolsContext } from '../../context';
import { h, rafBatch } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

const ROWS: readonly (keyof ConsoleCounts)[] = [...COUNTED_METHODS, 'uncaught'];

/**
 * The Console tab: calls per console method and uncaught errors since load (or the last reset),
 * with a reminder that SignalRGB expects a clean console.
 */
export function createConsoleTab({ consoleCounter, raf }: DevtoolsContext): TabInstance {
  const outputs = new Map(
    ROWS.map((key) => [key, h('output', { class: 'value', 'data-srgb-console': key })]),
  );
  const render = () => {
    for (const [key, output] of outputs) output.textContent = String(consoleCounter.counts[key]);
  };
  consoleCounter.subscribe(rafBatch(raf.request, render));
  render();
  const reset = h(
    'button',
    { type: 'button', class: 'button', 'data-srgb-devtools': 'console-reset' },
    'Reset',
  );
  reset.addEventListener('click', () => consoleCounter.reset());

  const element = h(
    'div',
    { 'data-srgb-devtools': 'console' },
    h(
      'div',
      { class: 'rows' },
      ...ROWS.map((key) =>
        h(
          'div',
          { class: 'row' },
          h('span', {}, key === 'uncaught' ? 'uncaught errors' : `console.${key}`),
          h('span'),
          outputs.get(key)!,
        ),
      ),
    ),
    h('div', { class: 'actions' }, reset),
    h(
      'p',
      { class: 'note' },
      'SignalRGB expects a clean console. The build strips console calls (dropConsole), but uncaught errors still show up.',
    ),
  );
  return { element, show: render };
}

export const consoleTab: TabDefinition = {
  id: 'console',
  label: 'Console',
  create: createConsoleTab,
};
