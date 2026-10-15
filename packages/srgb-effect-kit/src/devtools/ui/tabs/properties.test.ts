// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANIFEST, resetDevtoolsWindow } from '../../../../test/helpers/devtools';
import type { DevtoolsContext } from '../../context';
import { createPropertyController } from '../../properties';
import { createStorage } from '../../storage';
import { createPropertiesTab, hueGradient } from './properties';

const globals = window as unknown as Record<string, unknown>;

const mount = () => {
  const storage = createStorage(MANIFEST.title, () => localStorage);
  const properties = createPropertyController(MANIFEST.properties, storage, window);
  const tab = createPropertiesTab({ properties } as DevtoolsContext);
  document.body.append(tab.element);
  const control = <T extends HTMLElement = HTMLInputElement>(name: string) =>
    tab.element.querySelector<T>(`[data-srgb-control="${name}"]`)!;
  return { tab, properties, control };
};

/** Sets an input's value the way a user would and dispatches `type`. */
const input = (element: HTMLInputElement | HTMLSelectElement, value: string, type = 'input') => {
  element.value = value;
  element.dispatchEvent(new Event(type, { bubbles: true }));
};

beforeEach(() => {
  resetDevtoolsWindow();
  vi.stubGlobal('reportError', vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe('Properties tab', () => {
  it('renders one row per property in manifest order, with the matching control', () => {
    const { tab, control } = mount();
    const rows = [...tab.element.querySelectorAll<HTMLElement>('[data-srgb-property]')];
    expect(rows.map((row) => row.dataset.srgbProperty)).toEqual([
      'speed',
      'baseHue',
      'rainbow',
      'tint',
      'text',
      'mode',
    ]);
    expect(rows[0]!.querySelector('label')!.textContent).toBe('Speed');
    expect(control('speed')).toMatchObject({ type: 'range', min: '0', max: '100', value: '50' });
    expect(control('baseHue')).toMatchObject({ type: 'range', min: '0', max: '360', value: '120' });
    expect(control('baseHue').classList.contains('hue')).toBe(true);
    expect(control('baseHue').style.getPropertyValue('--track')).toBe(hueGradient(0, 360));
    expect(control('rainbow')).toMatchObject({ type: 'checkbox', checked: true });
    expect(control('tint')).toMatchObject({ type: 'color', value: '#009bde' });
    expect(control('text')).toMatchObject({ type: 'text', value: '' });
    const mode = control<HTMLSelectElement>('mode');
    expect([...mode.options].map((option) => option.value)).toEqual(['Wave', 'Pulse']);
    expect(mode.value).toBe('Wave');
  });

  it('sets globals in raw format and calls the handler on change', () => {
    const { control } = mount();
    const calls: unknown[] = [];
    globals.onSpeedChanged = () => calls.push(globals.speed);
    globals.onRainbowChanged = () => calls.push(globals.rainbow);
    globals.onTextChanged = () => calls.push(globals.text);
    globals.onModeChanged = () => calls.push(globals.mode);

    input(control('speed'), '80');
    const rainbow = control('rainbow');
    rainbow.checked = false;
    rainbow.dispatchEvent(new Event('change'));
    input(control('text'), 'h');
    input(control('text'), 'hi');
    input(control<HTMLSelectElement>('mode'), 'Pulse', 'change');
    expect(calls).toEqual([80, '0', 'h', 'hi', 'Pulse']);
  });

  it('shows the current number value next to the slider', () => {
    const { tab, control } = mount();
    input(control('speed'), '42');
    expect(tab.element.querySelector('[data-srgb-property="speed"] output')!.textContent).toBe(
      '42',
    );
  });

  it('resets every control and global to the defaults', () => {
    const { tab, control } = mount();
    input(control('speed'), '80');
    input(control<HTMLSelectElement>('mode'), 'Pulse', 'change');
    tab.element
      .querySelector<HTMLButtonElement>('[data-srgb-devtools="reset-properties"]')!
      .click();
    expect(globals.speed).toBe(50);
    expect(globals.mode).toBe('Wave');
    expect(control('speed').value).toBe('50');
    expect(control<HTMLSelectElement>('mode').value).toBe('Wave');
  });

  it('renders labels and list values as text', () => {
    const storage = createStorage('X', () => localStorage);
    const properties = createPropertyController(
      [
        {
          property: 'odd',
          type: 'list',
          label: '<img src=x onerror=alert(1)>',
          values: ['<b>', 'a&b'],
          default: '<b>',
        },
      ],
      storage,
      window,
    );
    const { element } = createPropertiesTab({ properties } as DevtoolsContext);
    expect(element.querySelector('img')).toBeNull();
    expect(element.querySelector('label')!.textContent).toBe('<img src=x onerror=alert(1)>');
    expect([...element.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      '<b>',
      'a&b',
    ]);
  });
});

describe('hueGradient', () => {
  it('spans the property range in six steps', () => {
    expect(hueGradient(0, 360)).toBe(
      'linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))',
    );
    expect(hueGradient(100, 160)).toContain('hsl(110 100% 50%)');
  });
});
