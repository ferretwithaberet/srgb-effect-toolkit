// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../../../test/helpers/devtools';
import { createCanvasApi } from '../../canvasApi';
import type { DevtoolsContext } from '../../context';
import { createStorage } from '../../storage';
import { createCanvasApiTab, curlCommand, formatRecord } from './canvasApi';

const mount = () => {
  const canvasApi = createCanvasApi(window);
  const storage = createStorage(MANIFEST.title, () => localStorage);
  const tab = createCanvasApiTab({ canvasApi, storage, win: window } as DevtoolsContext);
  const find = <T extends HTMLElement = HTMLInputElement>(name: string) =>
    tab.element.querySelector<T>(`[data-srgb-devtools="${name}"]`)!;
  return { tab, canvasApi, find };
};

beforeEach(() => resetDevtoolsWindow());

describe('Canvas API tab', () => {
  it('sends the form to onCanvasApiEvent and lists the event', () => {
    const { find } = mount();
    const handler = vi.fn();
    window.onCanvasApiEvent = handler;
    find('canvas-sender').value = 'game';
    find('canvas-event').value = 'hit';
    find('canvas-send').click();
    expect(handler).toHaveBeenCalledWith({ sender: 'game', event: 'hit' });
    expect(find('canvas-log').textContent).toContain('drawer game/hit');
  });

  it('lists events relayed from the dev server too', () => {
    const { canvasApi, find } = mount();
    canvasApi.dispatch({ sender: 'app', event: 'boom' }, 'http');
    expect(find('canvas-log').textContent).toContain('http app/boom (no onCanvasApiEvent)');
  });

  it('shows and persists the matching curl command', () => {
    const { find } = mount();
    const sender = find('canvas-sender');
    sender.value = 'my game';
    sender.dispatchEvent(new Event('input'));
    expect(find('canvas-curl').textContent).toBe(
      'curl -X POST "http://localhost:3000/canvas/event?sender=my+game&event=test"',
    );
    expect(mount().find('canvas-sender').value).toBe('my game');
  });
});

describe('canvas API helpers', () => {
  it('builds curl commands with encoded parameters', () => {
    expect(curlCommand('http://127.0.0.1:5173', 'a&b', 'x y')).toBe(
      'curl -X POST "http://127.0.0.1:5173/canvas/event?sender=a%26b&event=x+y"',
    );
  });

  it('formats history records', () => {
    const line = formatRecord({ sender: 's', event: 'e', source: 'http', handled: true, time: 0 });
    expect(line).toMatch(/ http s\/e$/);
  });
});
