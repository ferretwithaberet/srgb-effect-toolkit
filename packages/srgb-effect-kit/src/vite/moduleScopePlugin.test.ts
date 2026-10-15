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

  it('finds top-level const, let and var declarations, exported or not', () => {
    const code = `
      const onSpeedChanged = () => {};
      export const onCanvasApiEvent = (e: { sender: string }) => {};
      let helper = 1, other = 2;
    `;
    expect(findModuleScopedHandlers(code, 'main.ts', names)).toEqual([
      'onSpeedChanged',
      'onCanvasApiEvent',
    ]);
    expect(findModuleScopedHandlers('let a, onSpeedChanged;', 'main.js', names)).toEqual([
      'onSpeedChanged',
    ]);
    expect(findModuleScopedHandlers('var onCanvasApiEvent;', 'main.js', names)).toEqual([
      'onCanvasApiEvent',
    ]);
  });

  it('finds an export default function named after a handler', () => {
    expect(
      findModuleScopedHandlers('export default function onSpeedChanged() {}', 'main.ts', names),
    ).toEqual(['onSpeedChanged']);
    expect(findModuleScopedHandlers('export default function () {}', 'main.ts', names)).toEqual([]);
  });

  it('ignores destructuring and nested declarations', () => {
    const code = `
      const { onSpeedChanged } = window;
      function outer() { const onCanvasApiEvent = 1; }
    `;
    expect(findModuleScopedHandlers(code, 'main.ts', names)).toEqual([]);
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
