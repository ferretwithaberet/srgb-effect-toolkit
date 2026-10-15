import { describe, expect, it } from 'vitest';
import { resolveOptions } from './options';

describe('resolveOptions', () => {
  it('applies defaults and splits manifest from plugin options', () => {
    expect(resolveOptions({ title: 'Hue Cycle', publisher: 'me' })).toEqual({
      manifest: { title: 'Hue Cycle', publisher: 'me' },
      typesFile: 'src/srgb-effect.d.ts',
      fileName: 'hue-cycle.html',
      script: 'module',
      dropConsole: true,
      target: 'es2020',
      devtools: { fireChangedOnLoad: true },
    });
  });

  it('defaults script to module', () => {
    expect(resolveOptions({ title: 'X' }).script).toBe('module');
    expect(resolveOptions({ title: 'X', script: 'classic' }).script).toBe('classic');
  });

  it('respects overrides', () => {
    const resolved = resolveOptions({
      title: 'X',
      typesFile: 'types/effect.d.ts',
      fileName: 'custom.html',
      script: 'classic',
      dropConsole: false,
      target: ['chrome100', 'safari15'],
      devtools: { fireChangedOnLoad: false },
    });
    expect(resolved).toMatchObject({
      typesFile: 'types/effect.d.ts',
      fileName: 'custom.html',
      script: 'classic',
      dropConsole: false,
      target: ['chrome100', 'safari15'],
      devtools: { fireChangedOnLoad: false },
    });
    expect(resolveOptions({ title: 'X', devtools: false }).devtools).toBe(false);
    expect(resolveOptions({ title: 'X', devtools: {} }).devtools).toEqual({
      fireChangedOnLoad: true,
    });
  });

  it('rejects file names that are not plain .html files', () => {
    expect(() => resolveOptions({ title: 'X', fileName: 'out/x.html' })).toThrow(
      /fileName must be a plain file name/,
    );
    expect(() => resolveOptions({ title: 'X', fileName: 'x.htm' })).toThrow(
      /fileName must be a plain file name/,
    );
  });
});
