import { hslToHex } from '../../../runtime/color';
import { ZONE_COLUMNS, ZONE_ROWS } from '../../../runtime/zones';
import type { MeterDef } from '../../../shared';
import type { DevtoolsContext } from '../../context';
import type { MockZone } from '../../engine';
import { isHslMeter, resolveMeterRegion, toPixelRect, type PixelRect } from '../../meters';
import type { CaptureFrame, ScreenSource } from '../../screenController';
import { h, rafBatch } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

/** Preview canvas size: 10 px per zone cell. */
export const PREVIEW_WIDTH = ZONE_COLUMNS * 10;
export const PREVIEW_HEIGHT = ZONE_ROWS * 10;

/** Where each linear/area meter's region falls on a preview of `frame` scaled to `width`×`height`. */
export function previewRects(
  meters: readonly MeterDef[],
  frame: Pick<CaptureFrame, 'sourceWidth' | 'sourceHeight'>,
  width: number,
  height: number,
): { meter: string; rect: PixelRect }[] {
  return meters.filter(isHslMeter).map((meter) => ({
    meter: meter.meter,
    rect: toPixelRect(
      resolveMeterRegion(meter, frame.sourceWidth, frame.sourceHeight),
      meter.type === 'linear',
      width,
      height,
    ),
  }));
}

/** CSS color of one zone cell. */
export const zoneColor = (zone: MockZone, index: number): string =>
  hslToHex({ h: zone.hue[index]!, s: zone.saturation[index]!, l: zone.lightness[index]! });

const LABELS: Record<ScreenSource['kind'], string> = {
  solid: 'Solid color',
  gradient: 'Gradient',
  capture: 'Screen capture',
};

/**
 * The Screen tab: source buttons (`data-srgb-screen-source`), color inputs for solid and gradient,
 * the last capture error, and a preview of `engine.zone` (or, while capturing, the captured frame
 * with every linear/area meter's region outlined).
 */
export function createScreenTab({ screen, engine, config, raf }: DevtoolsContext): TabInstance {
  const meters = config.manifest.meters ?? [];
  const kinds = Object.keys(LABELS) as ScreenSource['kind'][];
  const buttons = kinds.map((kind) =>
    h('button', { type: 'button', 'data-srgb-screen-source': kind }, LABELS[kind]),
  );
  const color = h('input', { type: 'color', 'data-srgb-devtools': 'screen-color' });
  const from = h('input', { type: 'color', 'data-srgb-devtools': 'screen-from' });
  const to = h('input', { type: 'color', 'data-srgb-devtools': 'screen-to' });
  const solidRow = h('div', { class: 'row' }, h('span', {}, 'Color'), color, h('span'));
  const gradientRow = h(
    'div',
    { class: 'row' },
    h('span', {}, 'Left → right'),
    h('span', {}, from, ' ', to),
    h('span'),
  );
  const error = h('p', { class: 'error', 'data-srgb-devtools': 'screen-error', hidden: true });
  const preview = h('canvas', {
    class: 'preview',
    width: PREVIEW_WIDTH,
    height: PREVIEW_HEIGHT,
    'data-srgb-devtools': 'screen-preview',
  });

  // Remember the last colors so switching kinds doesn't lose them.
  let solid = '#000000';
  let gradient = { from: '#000000', to: '#ffffff' };

  buttons.forEach((button, i) => {
    button.addEventListener('click', () => {
      const kind = kinds[i]!;
      void screen.setSource(
        kind === 'solid'
          ? { kind, color: solid }
          : kind === 'gradient'
            ? { kind, ...gradient }
            : { kind },
      );
    });
  });
  color.addEventListener(
    'input',
    () => void screen.setSource({ kind: 'solid', color: color.value }),
  );
  const onGradient = () =>
    void screen.setSource({ kind: 'gradient', from: from.value, to: to.value });
  from.addEventListener('input', onGradient);
  to.addEventListener('input', onGradient);

  let scratch: HTMLCanvasElement | undefined;
  const draw = () => {
    const ctx = preview.getContext('2d');
    if (!ctx) return;
    const { frame } = screen;
    if (!frame) {
      for (let index = 0; index < ZONE_COLUMNS * ZONE_ROWS; index += 1) {
        ctx.fillStyle = zoneColor(engine.zone, index);
        ctx.fillRect((index % ZONE_COLUMNS) * 10, Math.floor(index / ZONE_COLUMNS) * 10, 10, 10);
      }
      return;
    }
    // One scratch canvas, resized only when the captured frame size changes.
    scratch ??= document.createElement('canvas');
    if (scratch.width !== frame.width || scratch.height !== frame.height) {
      scratch.width = frame.width;
      scratch.height = frame.height;
    }
    scratch
      .getContext('2d')
      ?.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
    ctx.drawImage(scratch, 0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);
    ctx.strokeStyle = '#ff1744';
    ctx.fillStyle = '#ff1744';
    ctx.font = '10px sans-serif';
    for (const { meter, rect } of previewRects(meters, frame, PREVIEW_WIDTH, PREVIEW_HEIGHT)) {
      ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.width, rect.height);
      ctx.fillText(meter, rect.x + 2, Math.max(10, rect.y - 2));
    }
  };
  let shown = false;
  const scheduleDraw = rafBatch(raf.request, () => {
    if (shown) draw();
  });

  const render = () => {
    const { source } = screen;
    if (source.kind === 'solid') solid = source.color;
    if (source.kind === 'gradient') gradient = { from: source.from, to: source.to };
    buttons.forEach((button, i) =>
      button.setAttribute('aria-pressed', String(kinds[i] === source.kind)),
    );
    color.value = solid;
    from.value = gradient.from;
    to.value = gradient.to;
    solidRow.hidden = source.kind !== 'solid';
    gradientRow.hidden = source.kind !== 'gradient';
    error.hidden = screen.error === undefined;
    error.textContent = screen.error ?? '';
    scheduleDraw();
  };
  screen.subscribe(render);
  render();

  const element = h(
    'div',
    { 'data-srgb-devtools': 'screen' },
    h('div', { class: 'segmented', role: 'group', 'aria-label': 'Screen source' }, ...buttons),
    error,
    h('div', { class: 'rows' }, solidRow, gradientRow),
    preview,
    h(
      'p',
      { class: 'note' },
      'Writes engine.zone (28×20 cells). Screen capture also drives the linear and area meters.',
    ),
  );
  return {
    element,
    show() {
      shown = true;
      scheduleDraw();
    },
    hide() {
      shown = false;
    },
  };
}

export const screenTab: TabDefinition = { id: 'screen', label: 'Screen', create: createScreenTab };
