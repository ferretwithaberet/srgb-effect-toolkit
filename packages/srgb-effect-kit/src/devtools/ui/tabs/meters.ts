import type { MeterDef } from '../../../shared';
import type { DevtoolsContext } from '../../context';
import { h, rafBatch } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

/** Readout of a meter value: two decimals for linear/area, the integer otherwise. */
export const formatMeterValue = (meter: MeterDef, value: number): string =>
  meter.type === 'linear' || meter.type === 'area' ? value.toFixed(2) : String(value);

/** The input for a meter's manual value. */
function meterInput(meter: MeterDef): HTMLInputElement | HTMLSelectElement {
  const attrs = { 'data-srgb-meter-control': meter.meter };
  switch (meter.type) {
    case 'linear':
    case 'area':
      return h('input', { ...attrs, type: 'range', min: 0, max: 1, step: 0.01 });
    case 'ocr_textmatch':
      return h(
        'select',
        attrs,
        h('option', { value: '1' }, '1 (found)'),
        h('option', { value: '0' }, '0 (not found)'),
        h('option', { value: '-1' }, '-1 (unsure)'),
      );
    case 'ocr_numeric':
      return h('input', { ...attrs, type: 'number', min: -1, step: 1 });
  }
}

/**
 * The Meters tab: one row per meter (`data-srgb-meter`) with a manual value control and the value
 * `engine.vision` holds. Linear and area controls are disabled while the Screen tab's capture
 * computes them.
 */
export function createMetersTab({ screen, engine, config, raf }: DevtoolsContext): TabInstance {
  const meters = config.manifest.meters ?? [];
  const rows = meters.map((meter) => {
    const input = meterInput(meter);
    const output = h('output', { class: 'value', 'data-srgb-meter-value': meter.meter });
    const commit = (final: boolean) => {
      const raw = input.value.trim();
      // An empty or partial number ('' or '-') is mid-edit: neither write nor overwrite it.
      if (raw === '' || !Number.isFinite(Number(raw))) {
        if (final) update(true);
        return;
      }
      screen.setMeter(meter.meter, Number(raw));
    };
    const update = (restore = false) => {
      const automatic = screen.isAutomatic(meter.meter);
      input.disabled = automatic;
      // The drawer lives in a shadow root, where `document.activeElement` is only the host.
      const focused = (input.getRootNode() as Document | ShadowRoot).activeElement === input;
      if (!automatic && (restore || !focused))
        input.value = String(screen.manualValue(meter.meter));
      const value = engine.vision[meter.meter] ?? 0;
      output.textContent = `${formatMeterValue(meter, value)}${automatic ? ' (capture)' : ''}`;
    };
    if (input instanceof HTMLSelectElement) input.addEventListener('change', () => commit(true));
    else {
      input.addEventListener('input', () => commit(false));
      input.addEventListener('change', () => commit(true));
    }
    const row = h(
      'div',
      { class: 'row', 'data-srgb-meter': meter.meter },
      h('label', {}, `${meter.meter} (${meter.type})`),
      input,
      output,
    );
    return { row, update };
  });
  const updateAll = () => {
    for (const { update } of rows) update();
  };
  screen.subscribe(rafBatch(raf.request, updateAll));
  updateAll();

  const element = h(
    'div',
    { 'data-srgb-devtools': 'meters' },
    rows.length > 0
      ? h('div', { class: 'rows' }, ...rows.map(({ row }) => row))
      : h('p', { class: 'note' }, 'This effect declares no meters.'),
    h(
      'p',
      { class: 'note' },
      'Values go to engine.vision.<meter>. OCR meters are always manual; linear and area meters follow the Screen tab while it captures.',
    ),
  );
  return { element, show: updateAll };
}

export const metersTab: TabDefinition = { id: 'meters', label: 'Meters', create: createMetersTab };
