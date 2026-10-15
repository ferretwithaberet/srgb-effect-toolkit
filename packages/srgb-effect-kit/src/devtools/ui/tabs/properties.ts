import type { PropertyDef } from '../../../shared';
import type { DevtoolsContext } from '../../context';
import { propertyRange, type RawValue } from '../../properties';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';

/** CSS gradient across the hues from `min` to `max`, for a hue slider's track. */
export function hueGradient(min: number, max: number): string {
  const stops = Array.from({ length: 7 }, (_, i) => `hsl(${min + ((max - min) * i) / 6} 100% 50%)`);
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/** A property's input, the text shown in the row's value column, and a silent updater. */
export interface PropertyControl {
  readonly input: HTMLInputElement | HTMLSelectElement;
  readonly value: HTMLElement;
  /** Shows `value` without dispatching events. */
  update(value: RawValue): void;
}

/**
 * Builds the input for one property: a slider for number and hue (hue with a hue-gradient track),
 * a checkbox for boolean, a color picker, a text input that reports every keystroke, and a select
 * for list. `onChange` receives the input's value (a string, or a boolean for checkboxes).
 */
export function createControl(
  p: PropertyDef,
  initial: RawValue,
  onChange: (value: string | boolean) => void,
): PropertyControl {
  const attrs = { id: `srgb-property-${p.property}`, 'data-srgb-control': p.property };
  const value = h('output', { class: 'value', for: attrs.id });
  let input: HTMLInputElement | HTMLSelectElement;
  switch (p.type) {
    case 'number':
    case 'hue': {
      const [min, max] = propertyRange(p);
      input = h('input', { ...attrs, type: 'range', min, max, step: 1 });
      if (p.type === 'hue') {
        input.classList.add('hue');
        input.style.setProperty('--track', hueGradient(min, max));
      }
      input.addEventListener('input', () => onChange(input.value));
      break;
    }
    case 'boolean': {
      const checkbox = h('input', { ...attrs, type: 'checkbox' });
      checkbox.addEventListener('change', () => onChange(checkbox.checked));
      input = checkbox;
      break;
    }
    case 'color':
    case 'textfield':
      input = h('input', { ...attrs, type: p.type === 'color' ? 'color' : 'text' });
      // `input` fires per keystroke for text and continuously while picking a color.
      input.addEventListener('input', () => onChange(input.value));
      break;
    case 'list':
      input = h(
        'select',
        attrs,
        ...p.values.map((option) => h('option', { value: option }, option)),
      );
      input.addEventListener('change', () => onChange(input.value));
      break;
  }
  const update = (next: RawValue) => {
    if (input instanceof HTMLInputElement && input.type === 'checkbox')
      input.checked = next === '1';
    else input.value = String(next);
    value.textContent =
      p.type === 'number' || p.type === 'hue' || p.type === 'color' ? String(next) : '';
  };
  update(initial);
  return { input, value, update };
}

/** The Properties tab: one row per property in manifest order, plus "Reset to defaults". */
export function createPropertiesTab({ properties }: DevtoolsContext): TabInstance {
  const controls = new Map<string, PropertyControl>();
  const rows = properties.definitions.map((p) => {
    const control = createControl(p, properties.get(p.property)!, (value) =>
      properties.set(p.property, value),
    );
    controls.set(p.property, control);
    return h(
      'div',
      { class: 'row', 'data-srgb-property': p.property },
      h('label', { for: control.input.id, title: p.tooltip }, p.label),
      control.input,
      control.value,
    );
  });
  // Keeps controls in sync with changes made elsewhere (reset, or another control's handler).
  properties.subscribe((name, value) => controls.get(name)?.update(value));

  const reset = h(
    'button',
    { type: 'button', class: 'button', 'data-srgb-devtools': 'reset-properties' },
    'Reset to defaults',
  );
  reset.addEventListener('click', () => properties.reset());

  const element = h(
    'div',
    { 'data-srgb-devtools': 'properties' },
    rows.length > 0
      ? h('div', { class: 'rows' }, ...rows)
      : h('p', { class: 'note' }, 'This effect declares no properties.'),
    h('div', { class: 'actions' }, reset),
    h(
      'p',
      { class: 'note' },
      'Changes set the global, then call window.on<Property>Changed() with no arguments, like SignalRGB.',
    ),
  );
  return { element };
}

export const propertiesTab: TabDefinition = {
  id: 'properties',
  label: 'Properties',
  create: createPropertiesTab,
};
