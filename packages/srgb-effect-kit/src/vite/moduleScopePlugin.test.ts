import { describe, expect, it } from 'vitest';
import { findModuleScopedHandlers } from './moduleScopePlugin';

const names = new Set(['onSpeedChanged', 'onCanvasApiEvent']);

describe('findModuleScopedHandlers', () => {
  it('finds top-level function declarations, exported or not', () => {
    const code = `
      function onSpeedChanged(): void {}
      export function onCanvasApiEvent(e: { sender: string }) {}
      function helper() {}
    `;
    expect(findModuleScopedHandlers(code, 'main.ts', names)).toEqual([
      'onSpeedChanged',
      'onCanvasApiEvent',
    ]);
  });

  it('ignores assignments, nested functions and unrelated names', () => {
    const code = `
      window.onSpeedChanged = () => {};
      onCanvasApiEvent = function onCanvasApiEvent() {};
      function outer() { function onSpeedChanged() {} }
      function onModeChanged() {}
    `;
    expect(findModuleScopedHandlers(code, 'main.ts', names)).toEqual([]);
  });

  it('returns nothing for unparsable code', () => {
    expect(findModuleScopedHandlers('function (', 'main.js', names)).toEqual([]);
  });
});
