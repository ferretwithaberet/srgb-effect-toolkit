import { CANVAS_EVENT_PATH } from '../../../shared';
import type { CanvasEventRecord } from '../../canvasApi';
import type { DevtoolsContext } from '../../context';
import { isRecord } from '../../storage';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

const STORAGE_KEY = 'canvas-api';

/** The `curl` command that sends the same event through the dev server. */
export const curlCommand = (origin: string, sender: string, event: string): string =>
  `curl -X POST "${origin}${CANVAS_EVENT_PATH}?${new URLSearchParams({ sender, event }).toString()}"`;

/** One history line, e.g. `12:00:01 http game/hit`, flagged when no handler was assigned. */
export const formatRecord = ({ time, source, sender, event, handled }: CanvasEventRecord): string =>
  `${new Date(time).toLocaleTimeString()} ${source} ${sender}/${event}${handled ? '' : ' (no onCanvasApiEvent)'}`;

const isForm = (value: unknown): value is { sender: string; event: string } =>
  isRecord(value) && typeof value.sender === 'string' && typeof value.event === 'string';

/**
 * The Canvas API tab: sender and event inputs (persisted), a Send button that calls
 * `window.onCanvasApiEvent({ sender, event })`, the equivalent `curl` command for the dev server,
 * and the latest events from both sources.
 */
export function createCanvasApiTab({ canvasApi, storage, win }: DevtoolsContext): TabInstance {
  const saved = storage.read(STORAGE_KEY, isForm) ?? { sender: 'devtools', event: 'test' };
  const sender = h('input', {
    type: 'text',
    value: saved.sender,
    'data-srgb-devtools': 'canvas-sender',
  });
  const event = h('input', {
    type: 'text',
    value: saved.event,
    'data-srgb-devtools': 'canvas-event',
  });
  const send = h(
    'button',
    { type: 'button', class: 'button', 'data-srgb-devtools': 'canvas-send' },
    'Send',
  );
  const curl = h('code', { 'data-srgb-devtools': 'canvas-curl' });
  const log = h('ul', { class: 'log', 'data-srgb-devtools': 'canvas-log' });

  const updateCurl = () => {
    curl.textContent = curlCommand(win.location.origin, sender.value, event.value);
    storage.write(STORAGE_KEY, { sender: sender.value, event: event.value });
  };
  sender.addEventListener('input', updateCurl);
  event.addEventListener('input', updateCurl);
  send.addEventListener('click', () =>
    canvasApi.dispatch({ sender: sender.value, event: event.value }, 'drawer'),
  );
  const renderLog = (history: readonly CanvasEventRecord[]) =>
    log.replaceChildren(...history.map((record) => h('li', {}, formatRecord(record))));
  canvasApi.subscribe(renderLog);
  renderLog(canvasApi.history);
  updateCurl();

  const element = h(
    'div',
    { 'data-srgb-devtools': 'canvas-api' },
    h(
      'div',
      { class: 'rows' },
      h('div', { class: 'row' }, h('label', {}, 'sender'), sender, h('span')),
      h('div', { class: 'row' }, h('label', {}, 'event'), event, h('span')),
    ),
    h('div', { class: 'actions' }, send),
    h('p', { class: 'note' }, 'Apps can post to the dev server like they post to SignalRGB:'),
    curl,
    log,
  );
  return { element };
}

export const canvasApiTab: TabDefinition = {
  id: 'canvas',
  label: 'Canvas API',
  create: createCanvasApiTab,
};
