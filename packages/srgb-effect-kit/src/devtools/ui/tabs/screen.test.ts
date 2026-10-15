// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG, MANIFEST } from '../../../../test/helpers/devtools';
import type { DevtoolsContext } from '../../context';
import { createEngineMock } from '../../engine';
import { createScreenController, type OpenScreenCapture } from '../../screenController';
import { createStorage } from '../../storage';
import { createScreenTab, previewRects, zoneColor } from './screen';

const mount = (openCapture: OpenScreenCapture = vi.fn()) => {
  const engine = createEngineMock(MANIFEST.meters);
  const storage = createStorage(MANIFEST.title, () => localStorage);
  const raf = { request: vi.fn(() => 1), cancel: vi.fn() };
  const screen = createScreenController(engine, MANIFEST.meters, storage, raf, openCapture);
  const tab = createScreenTab({
    screen,
    engine,
    config: CONFIG,
    raf,
  } as unknown as DevtoolsContext);
  const find = <T extends HTMLElement>(selector: string) => tab.element.querySelector<T>(selector)!;
  return { tab, screen, engine, find };
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

describe('Screen tab', () => {
  it('switches sources and edits their colors', async () => {
    const { screen, find } = mount();
    expect(find('[data-srgb-screen-source="solid"]').getAttribute('aria-pressed')).toBe('true');
    const color = find<HTMLInputElement>('[data-srgb-devtools="screen-color"]');
    color.value = '#ff0000';
    color.dispatchEvent(new Event('input'));
    expect(screen.source).toEqual({ kind: 'solid', color: '#ff0000' });

    find('[data-srgb-screen-source="gradient"]').click();
    await Promise.resolve();
    expect(screen.source).toEqual({ kind: 'gradient', from: '#000000', to: '#ffffff' });
    expect(
      find('[data-srgb-devtools="screen-color"]').closest('.row')!.hasAttribute('hidden'),
    ).toBe(true);
    find('[data-srgb-screen-source="solid"]').click();
    expect(screen.source).toEqual({ kind: 'solid', color: '#ff0000' });
  });

  it('shows why a capture failed', async () => {
    const { find } = mount(async () => {
      throw new Error('Permission denied');
    });
    find('[data-srgb-screen-source="capture"]').click();
    await vi.waitFor(() =>
      expect(find('[data-srgb-devtools="screen-error"]').textContent).toBe('Permission denied'),
    );
    expect(find('[data-srgb-screen-source="solid"]').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('screen helpers', () => {
  it('maps meter regions onto the preview', () => {
    expect(
      previewRects(MANIFEST.meters, { sourceWidth: 1920, sourceHeight: 1080 }, 280, 200),
    ).toEqual([
      { meter: 'health', rect: { x: 28, y: 100, width: 140, height: 1 } },
      { meter: 'mana', rect: { x: 140, y: 0, width: 140, height: 100 } },
    ]);
  });

  it('converts zone cells to CSS colors', () => {
    const { zone } = createEngineMock();
    zone.hue[3] = 120;
    zone.saturation[3] = 100;
    zone.lightness[3] = 50;
    expect(zoneColor(zone, 3)).toBe('#00ff00');
    expect(zoneColor(zone, 0)).toBe('#000000');
  });
});
