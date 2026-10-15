import { kebabCase, type EffectManifest } from '../shared';

export interface DevtoolsOptions {
  /** Call every on<Prop>Changed once at load, like SignalRGB does. @default true */
  fireChangedOnLoad?: boolean;
}

export interface SrgbEffectOptions extends EffectManifest {
  /** Generated globals typings, relative to the Vite root. Commit this file. @default 'src/srgb-effect.d.ts' */
  typesFile?: string;
  /** Output file name. @default kebab-cased title + '.html' */
  fileName?: string;
  /** @default 'classic' (IIFE in a classic <script>) */
  script?: 'classic' | 'module';
  /** Strip console.* and debugger from the build (SignalRGB requires a clean console). @default true */
  dropConsole?: boolean;
  /** Build target. Provisional until probed. @default 'es2020' */
  target?: string | string[];
  /** Dev-only devtools drawer. @default true */
  devtools?: boolean | DevtoolsOptions;
}

export interface ResolvedOptions {
  manifest: EffectManifest;
  typesFile: string;
  fileName: string;
  script: 'classic' | 'module';
  dropConsole: boolean;
  target: string | string[];
  devtools: false | Required<DevtoolsOptions>;
}

export function resolveOptions(options: SrgbEffectOptions): ResolvedOptions {
  const {
    typesFile = 'src/srgb-effect.d.ts',
    fileName,
    script = 'classic',
    dropConsole = true,
    target = 'es2020',
    devtools = true,
    ...manifest
  } = options;

  const resolvedFileName = fileName ?? `${kebabCase(manifest.title)}.html`;
  if (!resolvedFileName.endsWith('.html') || /[\\/]/.test(resolvedFileName)) {
    throw new Error(
      `[srgb-effect] fileName must be a plain file name ending in .html (got "${resolvedFileName}")`,
    );
  }

  return {
    manifest,
    typesFile,
    fileName: resolvedFileName,
    script,
    dropConsole,
    target,
    devtools:
      devtools === false
        ? false
        : {
            fireChangedOnLoad: (devtools === true ? undefined : devtools.fireChangedOnLoad) ?? true,
          },
  };
}
