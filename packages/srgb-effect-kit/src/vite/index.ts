import type { Plugin } from 'vite';
import { assertValidManifest, type PropertyDef } from '../shared';
import { buildPlugin } from './buildPlugin';
import { corePlugin } from './corePlugin';
import { resolveOptions, type SrgbEffectOptions } from './options';

export type { DevtoolsOptions, ResolvedOptions, SrgbEffectOptions } from './options';
export type * from '../shared/types';

type CheckListDefault<P> = P extends { type: 'list'; values: readonly (infer V)[] }
  ? Omit<P, 'default'> & { default: V }
  : P;

/** Makes a list property whose default is not in `values` a type error. */
export type CheckedProperties<P extends readonly PropertyDef[]> = P & {
  readonly [K in keyof P]: CheckListDefault<P[K]>;
};

export function srgbEffect<const P extends readonly PropertyDef[] = readonly []>(
  options: Omit<SrgbEffectOptions, 'properties'> & { properties?: CheckedProperties<P> },
): Plugin[] {
  const resolved = resolveOptions(options);
  assertValidManifest(resolved.manifest);
  return [corePlugin(resolved), buildPlugin(resolved)];
}
