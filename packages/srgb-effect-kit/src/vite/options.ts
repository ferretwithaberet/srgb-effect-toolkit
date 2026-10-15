import { kebabCase, type EffectManifest } from '../shared';

/** Options for the dev-only devtools drawer (not built yet; the option is already accepted). */
export interface DevtoolsOptions {
  /** Call every on<Prop>Changed once at load, like SignalRGB does. @default true */
  fireChangedOnLoad?: boolean;
}

/** Options for `srgbEffect()`: the effect manifest plus build settings. */
export interface SrgbEffectOptions extends EffectManifest {
  /**
   * Generated globals typings, relative to the Vite root. Commit this file.
   * @default 'src/srgb-effect.d.ts'
   */
  typesFile?: string;
  /**
   * Output file name: a plain name ending in `.html`, without directories.
   * @default kebab-cased title + '.html'
   */
  fileName?: string;
  /**
   * `'classic'` bundles the effect as a strict-mode IIFE in a classic `<script>`. `'module'` emits
   * `<script type="module">`, which allows external imports, top-level await and `import.meta`.
   * @default 'classic'
   */
  script?: 'classic' | 'module';
  /**
   * Strip `console.*` and `debugger` from the build (SignalRGB requires a clean console). Also
   * minifies the script, even with `build.minify: false`. @default true
   */
  dropConsole?: boolean;
  /** Build target. Provisional until probed. @default 'es2020' */
  target?: string | string[];
  /** Dev-only devtools drawer. @default true */
  devtools?: boolean | DevtoolsOptions;
}

/** `SrgbEffectOptions` with defaults applied, split into the manifest and plugin settings. */
export interface ResolvedOptions {
  manifest: EffectManifest;
  typesFile: string;
  fileName: string;
  script: 'classic' | 'module';
  dropConsole: boolean;
  target: string | string[];
  devtools: false | Required<DevtoolsOptions>;
}

/**
 * Applies defaults and splits plugin settings from the manifest.
 * @throws Error when `fileName` does not end in `.html` or contains a path separator.
 */
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
