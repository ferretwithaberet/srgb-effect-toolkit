// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../../test/helpers/devtools';
import type { DevtoolsContext } from '../context';
import { createStorage } from '../storage';
import { h } from './dom';
import {
  clampDrawerSize,
  DEFAULT_DRAWER_STATE,
  isDrawerState,
  mountDrawer,
  type TabDefinition,
} from './drawer';

const STORAGE_KEY = 'srgb-effect-kit:Devtools Test:drawer';

const context = () =>
  ({
    win: window,
    storage: createStorage(MANIFEST.title, () => localStorage),
  }) as unknown as DevtoolsContext;

const tab = (id: string, hooks: Partial<Record<'show' | 'hide', () => void>> = {}) => {
  const create = vi.fn(() => ({ element: h('div', { 'data-tab-body': id }, id), ...hooks }));
  return { id, label: id.toUpperCase(), create } satisfies TabDefinition;
};

const find = (root: ShadowRoot, name: string) =>
  root.querySelector<HTMLElement>(`[data-srgb-devtools="${name}"]`)!;

beforeEach(() => resetDevtoolsWindow());

describe('mountDrawer', () => {
  it('mounts a closed drawer in an open shadow root on <html>', () => {
    const drawer = mountDrawer(context(), [tab('properties')]);
    expect(drawer.host.tagName).toBe('SRGB-EFFECT-DEVTOOLS');
    expect(drawer.host.parentElement).toBe(document.documentElement);
    expect(drawer.host.style.pointerEvents).toBe('none');
    expect(drawer.root.mode).toBe('open');
    expect(drawer.root.querySelector('style')?.textContent).toContain(':host');
    expect(find(drawer.root, 'panel').hidden).toBe(true);
    expect(find(drawer.root, 'toggle').hidden).toBe(false);
  });

  it('survives effect code that clears the body', () => {
    const drawer = mountDrawer(context(), []);
    document.body.innerHTML = '<canvas></canvas>';
    expect(drawer.host.isConnected).toBe(true);
  });

  it('toggles open and closed, persisting the state', () => {
    const drawer = mountDrawer(context(), [tab('properties')]);
    find(drawer.root, 'toggle').click();
    expect(find(drawer.root, 'panel').hidden).toBe(false);
    expect(find(drawer.root, 'toggle').hidden).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ open: true });
    find(drawer.root, 'close').click();
    expect(find(drawer.root, 'panel').hidden).toBe(true);
    expect(drawer.state.open).toBe(false);
  });

  it('creates tabs lazily and shows one at a time', () => {
    const hide = vi.fn();
    const show = vi.fn();
    const first = tab('properties', { hide });
    const second = tab('audio', { show });
    const drawer = mountDrawer(context(), [first, second]);
    expect(first.create).not.toHaveBeenCalled();
    drawer.open();
    expect(first.create).toHaveBeenCalledOnce();
    expect(second.create).not.toHaveBeenCalled();

    drawer.root.querySelector<HTMLElement>('[data-srgb-devtools-tab="audio"]')!.click();
    expect(drawer.state.tab).toBe('audio');
    expect(hide).toHaveBeenCalledOnce();
    expect(show).toHaveBeenCalledOnce();
    const bodies = drawer.root.querySelectorAll<HTMLElement>('[data-tab-body]');
    expect([...bodies].map((body) => body.hidden)).toEqual([true, false]);
    expect(
      drawer.root.querySelector('[data-srgb-devtools-tab="audio"]')!.getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('restores persisted state, falling back for unknown tabs and invalid data', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_DRAWER_STATE, open: true, dock: 'right', tab: 'gone' }),
    );
    const drawer = mountDrawer(context(), [tab('properties')]);
    expect(drawer.state).toMatchObject({ open: true, dock: 'right', tab: 'properties' });
    expect(find(drawer.root, 'panel').dataset.dock).toBe('right');

    resetDevtoolsWindow();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ open: 'yes' }));
    expect(mountDrawer(context(), []).state).toEqual(DEFAULT_DRAWER_STATE);
  });

  it('docks, resizes within limits and toggles the overlay', () => {
    const drawer = mountDrawer(context(), []);
    find(drawer.root, 'dock').click();
    expect(drawer.state.dock).toBe('right');
    drawer.setSize(10);
    expect(drawer.state.size).toBe(160);
    drawer.setSize(100_000);
    expect(drawer.state.size).toBe(Math.floor(window.innerWidth * 0.9));

    expect(find(drawer.root, 'area-right').hidden).toBe(false);
    expect(find(drawer.root, 'dim-right').hidden).toBe(true);
    find(drawer.root, 'marker').click();
    find(drawer.root, 'dim').click();
    expect(find(drawer.root, 'area-right').hidden).toBe(true);
    expect(find(drawer.root, 'dim-right').hidden).toBe(false);
  });

  it('shows a badge count only when positive', () => {
    const drawer = mountDrawer(context(), []);
    drawer.setBadge(3);
    expect(find(drawer.root, 'badge').hidden).toBe(false);
    expect(find(drawer.root, 'badge').textContent).toBe('3');
    drawer.setBadge(250);
    expect(find(drawer.root, 'badge').textContent).toBe('99+');
    drawer.setBadge(0);
    expect(find(drawer.root, 'badge').hidden).toBe(true);
  });
});

describe('drawer helpers', () => {
  it('validates persisted state', () => {
    expect(isDrawerState(DEFAULT_DRAWER_STATE)).toBe(true);
    expect(isDrawerState({ ...DEFAULT_DRAWER_STATE, dock: 'left' })).toBe(false);
    expect(isDrawerState({ ...DEFAULT_DRAWER_STATE, size: Number.NaN })).toBe(false);
    expect(isDrawerState(null)).toBe(false);
  });

  it('clamps the size to 160px..90% of the viewport', () => {
    const viewport = { width: 1000, height: 500 };
    expect(clampDrawerSize(50, 'bottom', viewport)).toBe(160);
    expect(clampDrawerSize(480, 'bottom', viewport)).toBe(450);
    expect(clampDrawerSize(480, 'right', viewport)).toBe(480);
    expect(clampDrawerSize(300, 'bottom', { width: 100, height: 100 })).toBe(160);
  });
});
