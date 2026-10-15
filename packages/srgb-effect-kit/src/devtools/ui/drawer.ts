import type { DevtoolsContext } from '../context';
import { h } from './dom';
import { createAreaOverlay } from './overlay';
import { DEVTOOLS_CSS } from './styles';

/** Tag of the shadow host, appended to `<html>` so effect code that clears `<body>` keeps it. */
export const HOST_TAG = 'srgb-effect-devtools';
/** Smallest drawer height (bottom dock) or width (right dock), in CSS pixels. */
export const MIN_DRAWER_SIZE = 160;

export type Dock = 'bottom' | 'right';

/** Persisted drawer state. */
export interface DrawerState {
  open: boolean;
  dock: Dock;
  /** Height when docked bottom, width when docked right. */
  size: number;
  /** Id of the selected tab. */
  tab: string;
  /** Visible-area marker lines. */
  marker: boolean;
  /** Dimming outside the visible area. */
  dim: boolean;
}

export const DEFAULT_DRAWER_STATE: DrawerState = {
  open: false,
  dock: 'bottom',
  size: 320,
  tab: 'properties',
  marker: true,
  dim: false,
};

/** What a tab's `create()` returns. `show`/`hide` let tabs run work only while visible. */
export interface TabInstance {
  readonly element: HTMLElement;
  show?(): void;
  hide?(): void;
}

/** One drawer tab. `create` runs the first time the tab is shown. */
export interface TabDefinition {
  id: string;
  label: string;
  create(context: DevtoolsContext): TabInstance;
}

export interface DrawerHandle {
  readonly host: HTMLElement;
  readonly root: ShadowRoot;
  readonly state: Readonly<DrawerState>;
  open(): void;
  close(): void;
  toggle(): void;
  setDock(dock: Dock): void;
  setSize(size: number): void;
  select(tab: string): void;
  setOverlay(overlay: Partial<Pick<DrawerState, 'marker' | 'dim'>>): void;
  /** Shows `count` on the toggle button; hidden at 0. */
  setBadge(count: number): void;
}

const STORAGE_KEY = 'drawer';

export const isDrawerState = (value: unknown): value is DrawerState => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.open === 'boolean' &&
    (v.dock === 'bottom' || v.dock === 'right') &&
    typeof v.size === 'number' &&
    Number.isFinite(v.size) &&
    typeof v.tab === 'string' &&
    typeof v.marker === 'boolean' &&
    typeof v.dim === 'boolean'
  );
};

/** Clamps the drawer size between `MIN_DRAWER_SIZE` and 90% of the viewport along its dock axis. */
export function clampDrawerSize(
  size: number,
  dock: Dock,
  viewport: { width: number; height: number },
): number {
  const max = Math.max(
    MIN_DRAWER_SIZE,
    Math.floor(0.9 * (dock === 'bottom' ? viewport.height : viewport.width)),
  );
  return Math.min(max, Math.max(MIN_DRAWER_SIZE, Math.round(size)));
}

/**
 * Mounts the drawer: a shadow root holding the visible-area overlay, the toggle button and the
 * docked, resizable panel with one button per tab. State is persisted under `drawer`.
 */
export function mountDrawer(
  context: DevtoolsContext,
  tabs: readonly TabDefinition[],
): DrawerHandle {
  const { win, storage } = context;
  const viewport = () => ({ width: win.innerWidth, height: win.innerHeight });
  let state: DrawerState = { ...DEFAULT_DRAWER_STATE, ...storage.read(STORAGE_KEY, isDrawerState) };
  if (!tabs.some((tab) => tab.id === state.tab)) state.tab = tabs[0]?.id ?? state.tab;

  const host = win.document.createElement(HOST_TAG);
  // Covers the viewport without catching clicks; only the toggle and panel take pointer events.
  host.setAttribute(
    'style',
    'position:fixed;inset:0;z-index:2147483647;pointer-events:none;display:block',
  );
  const root = host.attachShadow({ mode: 'open' });

  const overlay = createAreaOverlay();
  const badge = h('span', { class: 'badge', 'data-srgb-devtools': 'badge', hidden: true });
  const toggleButton = h(
    'button',
    {
      type: 'button',
      class: 'toggle',
      'data-srgb-devtools': 'toggle',
      title: 'SignalRGB devtools',
    },
    'SRGB',
    badge,
  );
  const tool = (name: string, label: string, title: string) =>
    h('button', { type: 'button', class: 'tool', 'data-srgb-devtools': name, title }, label);
  const markerButton = tool('marker', 'Area', 'Mark the visible 320×200 area');
  const dimButton = tool('dim', 'Dim', 'Dim everything outside the visible area');
  const dockButton = tool('dock', '', 'Move the drawer');
  const closeButton = tool('close', '×', 'Close');
  const tabBar = h('div', { class: 'tabs', role: 'tablist' });
  const content = h('div', { class: 'content', 'data-srgb-devtools': 'content' });
  const resize = h('div', { class: 'resize', 'data-srgb-devtools': 'resize' });
  const panel = h(
    'section',
    { class: 'panel', 'data-srgb-devtools': 'panel', hidden: true },
    resize,
    h(
      'header',
      { class: 'header' },
      tabBar,
      h('div', { class: 'tools' }, markerButton, dimButton, dockButton, closeButton),
    ),
    content,
  );
  root.append(h('style', {}, DEVTOOLS_CSS), overlay.element, panel, toggleButton);

  const buttons = new Map<string, HTMLButtonElement>();
  const instances = new Map<string, TabInstance>();
  let visible: TabInstance | undefined;

  const instanceFor = (id: string): TabInstance | undefined => {
    let instance = instances.get(id);
    if (instance) return instance;
    const definition = tabs.find((tab) => tab.id === id);
    if (!definition) return undefined;
    instance = definition.create(context);
    instance.element.hidden = true;
    instances.set(id, instance);
    content.append(instance.element);
    return instance;
  };

  const render = () => {
    panel.hidden = !state.open;
    toggleButton.hidden = state.open;
    panel.dataset.dock = state.dock;
    panel.style.setProperty('--size', `${state.size}px`);
    dockButton.textContent = state.dock === 'bottom' ? 'Dock right' : 'Dock bottom';
    markerButton.setAttribute('aria-pressed', String(state.marker));
    dimButton.setAttribute('aria-pressed', String(state.dim));
    overlay.update(state);
    for (const [id, button] of buttons)
      button.setAttribute('aria-selected', String(id === state.tab));
    const next = state.open ? instanceFor(state.tab) : undefined;
    if (next === visible) return;
    if (visible) {
      visible.element.hidden = true;
      visible.hide?.();
    }
    if (next) {
      next.element.hidden = false;
      next.show?.();
    }
    visible = next;
  };

  const update = (patch: Partial<DrawerState>) => {
    const next = { ...state, ...patch };
    state = { ...next, size: clampDrawerSize(next.size, next.dock, viewport()) };
    storage.write(STORAGE_KEY, state);
    render();
  };

  for (const tab of tabs) {
    const button = h(
      'button',
      { type: 'button', role: 'tab', class: 'tab', 'data-srgb-devtools-tab': tab.id },
      tab.label,
    );
    button.addEventListener('click', () => update({ tab: tab.id }));
    buttons.set(tab.id, button);
    tabBar.append(button);
  }

  toggleButton.addEventListener('click', () => update({ open: !state.open }));
  closeButton.addEventListener('click', () => update({ open: false }));
  dockButton.addEventListener('click', () =>
    update({ dock: state.dock === 'bottom' ? 'right' : 'bottom' }),
  );
  markerButton.addEventListener('click', () => update({ marker: !state.marker }));
  dimButton.addEventListener('click', () => update({ dim: !state.dim }));
  resize.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    resize.setPointerCapture?.(event.pointerId);
    const onMove = (move: PointerEvent) =>
      update({
        size:
          state.dock === 'bottom' ? win.innerHeight - move.clientY : win.innerWidth - move.clientX,
      });
    const onUp = () => {
      resize.removeEventListener('pointermove', onMove);
      resize.removeEventListener('pointerup', onUp);
    };
    resize.addEventListener('pointermove', onMove);
    resize.addEventListener('pointerup', onUp);
  });
  win.addEventListener('resize', () => update({}));

  state = { ...state, size: clampDrawerSize(state.size, state.dock, viewport()) };
  render();
  win.document.documentElement.append(host);

  return {
    host,
    root,
    get state() {
      return state;
    },
    open: () => update({ open: true }),
    close: () => update({ open: false }),
    toggle: () => update({ open: !state.open }),
    setDock: (dock) => update({ dock }),
    setSize: (size) => update({ size }),
    select: (tab) => update({ tab }),
    setOverlay: (overlayState) => update(overlayState),
    setBadge(count) {
      badge.hidden = count <= 0;
      badge.textContent = count > 99 ? '99+' : String(count);
    },
  };
}
