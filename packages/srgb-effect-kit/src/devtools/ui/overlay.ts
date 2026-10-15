import { h } from './dom';

/** SignalRGB shows only the top-left 320×200 of the page. */
export const VISIBLE_WIDTH = 320;
export const VISIBLE_HEIGHT = 200;

export interface OverlayState {
  /** Red lines just outside the visible area. */
  marker: boolean;
  /** Dims everything outside the visible area. */
  dim: boolean;
}

export interface AreaOverlay {
  readonly element: HTMLElement;
  update(state: OverlayState): void;
}

/**
 * The visible-area marker: a red line along x = 320 and one along y = 200, both outside the
 * visible pixels, and optional dimming of the rest of the page. Never intercepts pointer events.
 */
export function createAreaOverlay(): AreaOverlay {
  const part = (name: string, className: string, style: string) =>
    h('div', { 'data-srgb-devtools': name, class: className, style });
  const right = part(
    'area-right',
    'area-line',
    `left:${VISIBLE_WIDTH}px;top:0;width:1px;height:${VISIBLE_HEIGHT + 1}px`,
  );
  const bottom = part(
    'area-bottom',
    'area-line',
    `left:0;top:${VISIBLE_HEIGHT}px;width:${VISIBLE_WIDTH + 1}px;height:1px`,
  );
  const dimRight = part(
    'dim-right',
    'area-dim',
    `left:${VISIBLE_WIDTH + 1}px;top:0;right:0;bottom:0`,
  );
  const dimBottom = part(
    'dim-bottom',
    'area-dim',
    `left:0;top:${VISIBLE_HEIGHT + 1}px;width:${VISIBLE_WIDTH + 1}px;bottom:0`,
  );
  const element = h(
    'div',
    { class: 'area', 'data-srgb-devtools': 'area', 'aria-hidden': 'true' },
    dimRight,
    dimBottom,
    right,
    bottom,
  );
  return {
    element,
    update({ marker, dim }) {
      right.hidden = !marker;
      bottom.hidden = !marker;
      dimRight.hidden = !dim;
      dimBottom.hidden = !dim;
    },
  };
}
