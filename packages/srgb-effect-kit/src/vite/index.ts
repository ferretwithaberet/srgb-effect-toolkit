import type { Plugin } from 'vite';
import { assertValidManifest, type PropertyDef } from '../shared';
import { buildPlugin } from './buildPlugin';
import { corePlugin } from './corePlugin';
import { devtoolsPlugin } from './devtoolsPlugin';
import { moduleScopePlugin } from './moduleScopePlugin';
import { resolveOptions, type SrgbEffectOptions } from './options';

export type { DevtoolsMode, DevtoolsOptions, ResolvedOptions, SrgbEffectOptions } from './options';
export type * from '../shared/types';

type CheckListDefault<P> = P extends { type: 'list'; values: readonly (infer V)[] }
  ? Omit<P, 'default'> & { default: V }
  : P;

/** Makes a list property whose default is not in `values` a type error. */
export type CheckedProperties<P extends readonly PropertyDef[]> = P & {
  readonly [K in keyof P]: CheckListDefault<P[K]>;
};

/**
 * Vite plugin that turns a Vite project into a SignalRGB effect. It validates the options, writes
 * the globals typings file (`typesFile`), injects the generated `<title>` and `<meta>` tags into
 * `index.html`, warns about module-scoped change handlers, simulates SignalRGB in `vite` dev with
 * the devtools, and makes `vite build` emit one self-contained HTML file.
 *
 * @throws Error `[srgb-effect] Invalid effect manifest:` followed by every issue found, or a
 * `fileName` error.
 * @returns The plugins to put in Vite's `plugins` array.
 * @example
 * export default defineConfig({
 *   plugins: [
 *     srgbEffect({
 *       title: 'My Effect',
 *       properties: [
 *         { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
 *       ],
 *     }),
 *   ],
 * });
 */
export function srgbEffect<const P extends readonly PropertyDef[] = readonly []>(
  options: Omit<SrgbEffectOptions, 'properties'> & { properties?: CheckedProperties<P> },
): Plugin[] {
  // Validate first: untyped configs must get manifest issues, not a TypeError from resolveOptions.
  assertValidManifest(options);
  const resolved = resolveOptions(options);
  const plugins = [corePlugin(resolved), buildPlugin(resolved), moduleScopePlugin(resolved)];
  const { mode, fireChangedOnLoad } = resolved.devtools;
  if (mode !== 'none') plugins.push(devtoolsPlugin(resolved.manifest, { mode, fireChangedOnLoad }));
  return plugins;
}
