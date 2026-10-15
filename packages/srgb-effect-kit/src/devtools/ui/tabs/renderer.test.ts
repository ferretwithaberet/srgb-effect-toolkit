// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DevtoolsContext } from '../../context';
import { installRendererSimulation, overrideUserAgent } from '../../renderer';
import { createStorage } from '../../storage';
import { createRateMeter, createRendererTab } from './renderer';

const userAgent = navigator.userAgent;
const nativeRaf = window.requestAnimationFrame;

const mount = (stored?: object) => {
  if (stored) {
    localStorage.setItem('srgb-effect-kit:Renderer Tab:renderer', JSON.stringify(stored));
  }
  const reload = vi.fn();
  const renderer = installRendererSimulation(
    window,
    createStorage('Renderer Tab', () => localStorage),
    { request: (cb) => nativeRaf(cb), cancel: vi.fn() },
    reload,
  );
  const tab = createRendererTab({ renderer, win: window } as unknown as DevtoolsContext);
  const find = <T extends HTMLElement = HTMLElement>(selector: string) =>
    tab.element.querySelector<T>(selector)!;
  return { tab, renderer, reload, find };
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  overrideUserAgent(navigator, userAgent);
  window.requestAnimationFrame = nativeRaf;
});

describe('Renderer tab', () => {
  it('shows the active renderer, FPS and detected renderer', () => {
    const { find } = mount({ renderer: 'qtwebengine', fps: 30 });
    expect(find('[data-srgb-renderer="qtwebengine"]').getAttribute('aria-pressed')).toBe('true');
    expect(find<HTMLInputElement>('[data-srgb-devtools="fps"]').value).toBe('30');
    expect(find('[data-srgb-devtools="detected-renderer"]').textContent).toBe('qtwebengine');
    expect(find('[data-srgb-devtools="user-agent"]').textContent).toContain('QtWebEngine/');
  });

  it('applies FPS changes live and reloads on renderer changes', () => {
    const { find, renderer, reload } = mount();
    const fps = find<HTMLInputElement>('[data-srgb-devtools="fps"]');
    fps.value = '24';
    fps.dispatchEvent(new Event('input'));
    expect(renderer.settings.fps).toBe(24);
    expect(reload).not.toHaveBeenCalled();
    find('[data-srgb-renderer="ultralight"]').click();
    expect(reload).toHaveBeenCalledOnce();
    expect(renderer.settings.renderer).toBe('ultralight');
  });
});

describe('Renderer tab focus', () => {
  it('does not overwrite a focused FPS slider', () => {
    const { find, renderer } = mount();
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    document.body.append(host);
    const fps = find<HTMLInputElement>('[data-srgb-devtools="fps"]');
    shadow.append(fps.closest('[data-srgb-devtools="renderer"]')!);
    fps.focus();
    fps.value = '33';
    renderer.setFps(45);
    expect(fps.value).toBe('33');
    host.remove();
  });
});

describe('createRateMeter', () => {
  it('reports the frame rate once per second', () => {
    const meter = createRateMeter();
    const reports: (number | undefined)[] = [];
    for (let i = 0; i <= 60; i += 1) reports.push(meter.tick(i * (1000 / 30)));
    expect(reports.filter((rate) => rate !== undefined)).toEqual([30, 30]);
  });
});
