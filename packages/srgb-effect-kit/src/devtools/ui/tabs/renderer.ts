import { detectRenderer, type Renderer } from '../../../runtime/renderer';
import type { DevtoolsContext } from '../../context';
import { FPS_MAX, FPS_MIN } from '../../renderer';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

const LABELS: Record<Renderer, string> = {
  browser: 'Browser',
  ultralight: 'UltraLight',
  qtwebengine: 'QtWebEngine',
};

const NOTES: Record<Renderer, string> = {
  browser: 'No simulation: the native user agent and requestAnimationFrame.',
  ultralight:
    'UltraLight user agent; requestAnimationFrame runs at the FPS setting, as in SignalRGB.',
  qtwebengine:
    'QtWebEngine user agent; requestAnimationFrame keeps the display rate while SignalRGB samples frames at the FPS setting.',
};

/** Counts frames and reports the rate once per elapsed second. */
export function createRateMeter(): { tick(timestamp: number): number | undefined } {
  let start: number | undefined;
  let frames = 0;
  return {
    tick(timestamp) {
      if (start === undefined) {
        start = timestamp;
        frames = 0;
        return undefined;
      }
      frames += 1;
      const elapsed = timestamp - start;
      if (elapsed < 1000) return undefined;
      const rate = Math.round((frames * 1000) / elapsed);
      start = timestamp;
      frames = 0;
      return rate;
    },
  };
}

/**
 * The Renderer tab: renderer buttons (`data-srgb-renderer`; choosing one reloads the page), the
 * SignalRGB FPS setting (20–60, applied live), the reported user agent and `detectRenderer()`
 * result, and the requestAnimationFrame rate the effect actually gets, measured while shown.
 */
export function createRendererTab({ renderer, win }: DevtoolsContext): TabInstance {
  const buttons = (Object.keys(LABELS) as Renderer[]).map((id) => {
    const button = h('button', { type: 'button', 'data-srgb-renderer': id }, LABELS[id]);
    button.addEventListener('click', () => renderer.setRenderer(id));
    return button;
  });
  const fps = h('input', {
    type: 'range',
    min: FPS_MIN,
    max: FPS_MAX,
    step: 1,
    'data-srgb-devtools': 'fps',
  });
  const fpsValue = h('output', { class: 'value' });
  fps.addEventListener('input', () => renderer.setFps(Number(fps.value)));
  const note = h('p', { class: 'note', 'data-srgb-devtools': 'renderer-note' });
  const userAgent = h('code', { 'data-srgb-devtools': 'user-agent' });
  const detected = h('output', { 'data-srgb-devtools': 'detected-renderer' });
  const rate = h('output', { class: 'value', 'data-srgb-devtools': 'raf-rate' }, '–');

  const render = () => {
    const { settings } = renderer;
    for (const button of buttons) {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.srgbRenderer === settings.renderer),
      );
    }
    // The drawer lives in a shadow root, where `document.activeElement` is only the host. Don't
    // fight a slider that is being dragged or typed into.
    if ((fps.getRootNode() as Document | ShadowRoot).activeElement !== fps) {
      fps.value = String(settings.fps);
    }
    fpsValue.textContent = `${settings.fps} FPS`;
    note.textContent = NOTES[settings.renderer];
    userAgent.textContent = win.navigator.userAgent;
    detected.textContent = detectRenderer(win.navigator.userAgent);
  };
  renderer.subscribe(render);
  render();

  // Measured with the page's (possibly throttled) rAF: what the effect's own loop gets.
  let frameId: number | undefined;
  const meter = createRateMeter();
  const measure = (timestamp: number) => {
    const hz = meter.tick(timestamp);
    if (hz !== undefined) rate.textContent = `${hz} Hz`;
    frameId = win.requestAnimationFrame(measure);
  };

  const element = h(
    'div',
    { 'data-srgb-devtools': 'renderer' },
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Renderer' }, ...buttons),
    note,
    h(
      'div',
      { class: 'rows' },
      h('div', { class: 'row' }, h('label', {}, 'SignalRGB FPS'), fps, fpsValue),
      h('div', { class: 'row' }, h('span', {}, 'requestAnimationFrame'), h('span'), rate),
      h('div', { class: 'row' }, h('span', {}, 'detectRenderer()'), detected, h('span')),
    ),
    h('p', { class: 'note' }, 'navigator.userAgent: ', userAgent),
    h(
      'p',
      { class: 'note' },
      'User agents are placeholders until verified on SignalRGB. Changing the renderer reloads the page.',
    ),
  );
  return {
    element,
    show() {
      if (frameId === undefined) frameId = win.requestAnimationFrame(measure);
    },
    hide() {
      if (frameId !== undefined) win.cancelAnimationFrame(frameId);
      frameId = undefined;
    },
  };
}

export const rendererTab: TabDefinition = {
  id: 'renderer',
  label: 'Renderer',
  create: createRendererTab,
};
