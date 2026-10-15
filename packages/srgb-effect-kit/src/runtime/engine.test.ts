import { afterEach, describe, expect, it } from 'vitest';
import { getEngine } from './engine';

afterEach(() => {
  delete (globalThis as { engine?: unknown }).engine;
});

describe('getEngine', () => {
  it('returns undefined outside SignalRGB', () => {
    expect(getEngine()).toBeUndefined();
  });

  it('returns the injected engine global', () => {
    const engine = { audio: { level: -50, width: 0, density: 0, freq: [] } };
    (globalThis as { engine?: unknown }).engine = engine;
    expect(getEngine()).toBe(engine);
  });
});
