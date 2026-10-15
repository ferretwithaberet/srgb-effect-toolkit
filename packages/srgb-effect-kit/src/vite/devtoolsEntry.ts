import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Devtools modes that load a bundle: `'minimal'` (the environment only) or `'full'`. */
export type DevtoolsEntryMode = 'minimal' | 'full';

/** File name of each mode's entry, in dist/devtools and in src/devtools. */
const ENTRY_NAMES: Record<DevtoolsEntryMode, string> = { minimal: 'minimal', full: 'index' };

/**
 * Absolute path of a devtools entry, relative to this module: the built bundle
 * (dist/vite → dist/devtools/<name>.js) when the plugin runs from the package, then the TypeScript
 * source (src/vite → src/devtools/<name>.ts) when it runs from source, as in this repository's tests.
 * @param mode - `'minimal'` loads `minimal`, `'full'` loads `index`.
 * @param from - URL of the module to resolve from. @default import.meta.url
 * @throws Error when neither file exists.
 */
export function resolveDevtoolsEntry(
  mode: DevtoolsEntryMode,
  from: string = import.meta.url,
): string {
  const dir = path.dirname(fileURLToPath(from));
  const name = ENTRY_NAMES[mode];
  for (const extension of ['.js', '.ts']) {
    const file = path.resolve(dir, '../devtools', name + extension);
    if (fs.existsSync(file)) return file;
  }
  throw new Error(
    `[srgb-effect] devtools bundle "${name}" not found next to ${dir}. Reinstall srgb-effect-kit, or set devtools: 'none'.`,
  );
}
