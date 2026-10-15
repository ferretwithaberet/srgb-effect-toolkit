import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveDevtoolsEntry } from './devtoolsEntry';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

/** Creates `files` under a temp package root and returns the URL of `<root>/<from>`. */
const layout = (files: string[], from: string) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'srgb-devtools-entry-'));
  dirs.push(root);
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '');
  }
  return { root, url: pathToFileURL(path.join(root, from)).href };
};

describe('resolveDevtoolsEntry', () => {
  it('finds each mode’s built bundle next to the built plugin', () => {
    const { root, url } = layout(
      ['dist/vite/index.js', 'dist/devtools/index.js', 'dist/devtools/minimal.js'],
      'dist/vite/index.js',
    );
    expect(resolveDevtoolsEntry('full', url)).toBe(path.join(root, 'dist/devtools/index.js'));
    expect(resolveDevtoolsEntry('minimal', url)).toBe(path.join(root, 'dist/devtools/minimal.js'));
  });

  it('falls back to the TypeScript source when running from source', () => {
    const { root, url } = layout(
      ['src/vite/devtoolsEntry.ts', 'src/devtools/index.ts', 'src/devtools/minimal.ts'],
      'src/vite/devtoolsEntry.ts',
    );
    expect(resolveDevtoolsEntry('full', url)).toBe(path.join(root, 'src/devtools/index.ts'));
    expect(resolveDevtoolsEntry('minimal', url)).toBe(path.join(root, 'src/devtools/minimal.ts'));
  });

  it('throws a clear error when the bundle is missing', () => {
    const { url } = layout(['dist/vite/index.js', 'dist/devtools/index.js'], 'dist/vite/index.js');
    expect(() => resolveDevtoolsEntry('minimal', url)).toThrow(
      /\[srgb-effect\] devtools bundle "minimal" not found/,
    );
  });

  it('resolves the source entries from this module by default', () => {
    expect(resolveDevtoolsEntry('full')).toBe(
      path.resolve(import.meta.dirname, '../devtools/index.ts'),
    );
    expect(resolveDevtoolsEntry('minimal')).toBe(
      path.resolve(import.meta.dirname, '../devtools/minimal.ts'),
    );
  });
});
