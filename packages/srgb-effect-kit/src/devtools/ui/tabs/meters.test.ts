// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG, MANIFEST } from '../../../../test/helpers/devtools';
import type { DevtoolsContext } from '../../context';
import { createEngineMock } from '../../engine';
import { createScreenController, type CaptureFrame } from '../../screenController';
import { createStorage } from '../../storage';
import { createMetersTab, formatMeterValue } from './meters';

const green: CaptureFrame = {
  pixels: new Uint8ClampedArray(Array.from({ length: 100 }, () => [0, 200, 0, 255]).flat()),
  width: 10,
  height: 10,
  sourceWidth: 1280,
  sourceHeight: 720,
};

const mount = () => {
  const engine = createEngineMock(MANIFEST.meters);
  const storage = createStorage(MANIFEST.title, () => localStorage);
  const captureRaf = { request: () => 1, cancel: vi.fn() };
  const screen = createScreenController(engine, MANIFEST.meters, storage, captureRaf, async () => ({
    read: () => green,
    stop: () => {},
  }));
  const frames: FrameRequestCallback[] = [];
  const raf = { request: (cb: FrameRequestCallback) => frames.push(cb), cancel: vi.fn() };
  const tab = createMetersTab({
    screen,
    engine,
    config: CONFIG,
    raf,
  } as unknown as DevtoolsContext);
  const control = <T extends HTMLElement = HTMLInputElement>(name: string) =>
    tab.element.querySelector<T>(`[data-srgb-meter-control="${name}"]`)!;
  const value = (name: string) =>
    tab.element.querySelector(`[data-srgb-meter-value="${name}"]`)!.textContent;
  const flush = () => frames.splice(0).forEach((frame) => frame(0));
  return { tab, screen, engine, control, value, flush };
};

beforeEach(() => localStorage.clear());

describe('Meters tab', () => {
  it('renders one row and control per meter type', () => {
    const { tab, control, value } = mount();
    expect(
      [...tab.element.querySelectorAll<HTMLElement>('[data-srgb-meter]')].map(
        (row) => row.dataset.srgbMeter,
      ),
    ).toEqual(['health', 'mana', 'victory', 'score']);
    expect(control('health')).toMatchObject({ type: 'range', min: '0', max: '1', step: '0.01' });
    expect(control<HTMLSelectElement>('victory').tagName).toBe('SELECT');
    expect(control('score')).toMatchObject({ type: 'number', value: '-1' });
    expect(value('score')).toBe('-1');
    expect(value('health')).toBe('0.00');
  });

  it('writes manual values to engine.vision', () => {
    const { engine, control, value, flush } = mount();
    const health = control('health');
    health.value = '0.4';
    health.dispatchEvent(new Event('input'));
    const victory = control<HTMLSelectElement>('victory');
    victory.value = '-1';
    victory.dispatchEvent(new Event('change'));
    expect(engine.vision.health).toBe(0.4);
    expect(engine.vision.victory).toBe(-1);
    flush();
    expect(value('health')).toBe('0.40');
  });

  it('disables linear and area controls while the capture computes them', async () => {
    const { screen, control, value, flush } = mount();
    await screen.setSource({ kind: 'capture' });
    flush();
    expect(control('health').disabled).toBe(true);
    expect(control('victory' as string).hasAttribute('disabled')).toBe(false);
    expect(value('health')).toBe('1.00 (capture)');
  });

  it('formats values per meter type', () => {
    const [health, , , score] = MANIFEST.meters;
    expect(formatMeterValue(health, 0.5)).toBe('0.50');
    expect(formatMeterValue(score, 42)).toBe('42');
  });
});
