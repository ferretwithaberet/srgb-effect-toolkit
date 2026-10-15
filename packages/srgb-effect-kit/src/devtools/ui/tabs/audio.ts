import { AUDIO_MODES, type AudioMode } from '../../audioController';
import type { DevtoolsContext } from '../../context';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

const LABELS: Record<AudioMode, string> = {
  silent: 'Silent',
  random: 'Random',
  microphone: 'Microphone',
  system: 'System audio',
};

/** Readout text for the current `engine.audio`, e.g. `-12.3 dB`. */
export const formatLevel = (level: number): string => `${level.toFixed(1)} dB`;

/**
 * The Audio tab: one button per mode (`data-srgb-audio-mode`), the last capture error, live
 * level/width/density readouts and a 200-band spectrum, refreshed every native frame while shown.
 */
export function createAudioTab({ audio, engine, raf }: DevtoolsContext): TabInstance {
  const buttons = AUDIO_MODES.map((mode) => {
    const button = h(
      'button',
      { type: 'button', 'data-srgb-audio-mode': mode, 'aria-pressed': 'false' },
      LABELS[mode],
    );
    button.addEventListener('click', () => void audio.setMode(mode));
    return button;
  });
  const error = h('p', { class: 'error', 'data-srgb-devtools': 'audio-error', hidden: true });
  const level = h('output', { class: 'value', 'data-srgb-devtools': 'audio-level' });
  const width = h('output', { class: 'value', 'data-srgb-devtools': 'audio-width' });
  const density = h('output', { class: 'value', 'data-srgb-devtools': 'audio-density' });
  const bar = (fill: HTMLElement) => h('div', { class: 'bar' }, fill);
  const levelFill = h('span');
  const widthFill = h('span');
  const densityFill = h('span');
  const spectrum = h('canvas', {
    class: 'preview',
    width: 400,
    height: 80,
    'data-srgb-devtools': 'audio-spectrum',
  });

  const renderMode = () => {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.srgbAudioMode === audio.mode));
    }
    error.hidden = audio.error === undefined;
    error.textContent = audio.error ?? '';
  };
  audio.subscribe(renderMode);
  renderMode();

  let frameId: number | undefined;
  const draw = () => {
    const { level: dB, width: w, density: d, freq } = engine.audio;
    level.textContent = formatLevel(dB);
    width.textContent = w.toFixed(2);
    density.textContent = d.toFixed(2);
    levelFill.style.width = `${Math.max(0, dB + 100)}%`;
    widthFill.style.width = `${w * 100}%`;
    densityFill.style.width = `${d * 100}%`;
    const ctx = spectrum.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#0f1115';
      ctx.fillRect(0, 0, spectrum.width, spectrum.height);
      ctx.fillStyle = '#4c8dff';
      const barWidth = spectrum.width / freq.length;
      freq.forEach((band, i) => {
        const height = (Math.min(255, Math.max(0, band)) / 255) * spectrum.height;
        ctx.fillRect(i * barWidth, spectrum.height - height, Math.max(1, barWidth - 0.5), height);
      });
    }
    frameId = raf.request(draw);
  };

  const element = h(
    'div',
    { 'data-srgb-devtools': 'audio' },
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Audio source' }, ...buttons),
    error,
    h(
      'div',
      { class: 'rows' },
      h('div', { class: 'row' }, h('span', {}, 'level'), bar(levelFill), level),
      h('div', { class: 'row' }, h('span', {}, 'width'), bar(widthFill), width),
      h('div', { class: 'row' }, h('span', {}, 'density'), bar(densityFill), density),
    ),
    spectrum,
    h(
      'p',
      { class: 'note' },
      'Writes engine.audio every frame. System audio uses screen sharing: pick a tab or screen and tick "Share audio".',
    ),
  );

  return {
    element,
    show() {
      if (frameId === undefined) draw();
    },
    hide() {
      if (frameId !== undefined) raf.cancel(frameId);
      frameId = undefined;
    },
  };
}

export const audioTab: TabDefinition = { id: 'audio', label: 'Audio', create: createAudioTab };
