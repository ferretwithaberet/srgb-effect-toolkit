// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createAreaOverlay, VISIBLE_HEIGHT, VISIBLE_WIDTH } from './overlay';

const part = (element: HTMLElement, name: string) =>
  element.querySelector<HTMLElement>(`[data-srgb-devtools="${name}"]`)!;

describe('createAreaOverlay', () => {
  it('draws the marker lines just outside the visible 320×200 area', () => {
    const { element } = createAreaOverlay();
    expect([VISIBLE_WIDTH, VISIBLE_HEIGHT]).toEqual([320, 200]);
    expect(part(element, 'area-right').style.left).toBe('320px');
    expect(part(element, 'area-right').style.height).toBe('201px');
    expect(part(element, 'area-bottom').style.top).toBe('200px');
    expect(part(element, 'area-bottom').style.width).toBe('321px');
    expect(part(element, 'dim-right').style.left).toBe('321px');
    expect(part(element, 'dim-bottom').style.top).toBe('201px');
    expect(element.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the marker and the dimming independently', () => {
    const overlay = createAreaOverlay();
    overlay.update({ marker: false, dim: true });
    expect(part(overlay.element, 'area-right').hidden).toBe(true);
    expect(part(overlay.element, 'area-bottom').hidden).toBe(true);
    expect(part(overlay.element, 'dim-right').hidden).toBe(false);
    expect(part(overlay.element, 'dim-bottom').hidden).toBe(false);
  });
});
