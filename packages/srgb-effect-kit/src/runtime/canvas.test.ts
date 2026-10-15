// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCanvas } from './canvas';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('getCanvas', () => {
  it('returns the first canvas and its 2d context by default', () => {
    document.body.innerHTML = '<canvas id="a"></canvas><canvas id="b"></canvas>';
    const ctx = {} as CanvasRenderingContext2D;
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const handle = getCanvas();
    expect(handle.canvas.id).toBe('a');
    expect(handle.ctx).toBe(ctx);
    expect(spy).toHaveBeenCalledWith('2d');
  });

  it('selects by id and context type', () => {
    document.body.innerHTML = '<canvas id="a"></canvas><canvas id="b"></canvas>';
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    expect(getCanvas({ id: 'b', context: 'webgl2' }).canvas.id).toBe('b');
    expect(spy).toHaveBeenCalledWith('webgl2');
  });

  it('throws clear errors', () => {
    expect(() => getCanvas()).toThrow('[srgb-effect] getCanvas: no <canvas> element found');
    document.body.innerHTML = '<div id="x"></div>';
    expect(() => getCanvas({ id: 'x' })).toThrow(
      '[srgb-effect] getCanvas: no <canvas id="x"> element found',
    );
    document.body.innerHTML = '<canvas></canvas>';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => getCanvas({ context: 'webgl' })).toThrow(
      '[srgb-effect] getCanvas: "webgl" context is not available',
    );
  });
});
