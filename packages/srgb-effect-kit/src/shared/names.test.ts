import { describe, expect, it } from 'vitest';
import { handlerName, kebabCase } from './names';

describe('handlerName', () => {
  it('capitalizes the first letter and wraps with on…Changed', () => {
    expect(handlerName('speed')).toBe('onSpeedChanged');
    expect(handlerName('RGBModeEnabled')).toBe('onRGBModeEnabledChanged');
    expect(handlerName('x')).toBe('onXChanged');
  });
});

describe('kebabCase', () => {
  it('converts titles to file-safe kebab case', () => {
    expect(kebabCase('Hue Cycle')).toBe('hue-cycle');
    expect(kebabCase('Butterchurn SRGB')).toBe('butterchurn-srgb');
    expect(kebabCase('myEffect v2!')).toBe('my-effect-v2');
    expect(kebabCase('  Café  Lights ')).toBe('cafe-lights');
  });

  it('keeps digits attached to their letters and splits acronyms', () => {
    expect(kebabCase('Basic 2D')).toBe('basic-2d');
    expect(kebabCase('3D Cube')).toBe('3d-cube');
    expect(kebabCase('XMLParser')).toBe('xml-parser');
  });

  it('strips combining marks from decomposed input', () => {
    expect(kebabCase('Cafe\u0301 Nin\u0303o')).toBe('cafe-nino');
  });

  it('falls back to "effect" when nothing usable remains', () => {
    expect(kebabCase('!!!')).toBe('effect');
  });
});
