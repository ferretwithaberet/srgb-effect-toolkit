import { kebabCase, type EffectManifest } from '../shared';

/**
 * How much of SignalRGB `vite` dev simulates:
 * - `'none'`: nothing; the page is served as is.
 * - `'minimal'`: SignalRGB's environment only (handler and property globals at their defaults,
 *   the `engine` mock, load-time handler calls, `POST /canvas/event`), with nothing visible.
 * - `'full'`: the minimal environment plus the devtools drawer and its simulations.
 */
export type DevtoolsMode = 'none' | 'minimal' | 'full';

/** Object form of the `devtools` option. */
export interface DevtoolsOptions {
  /** @default 'full' */
  mode?: DevtoolsMode;
  /** Call every on<Prop>Changed once at load, like SignalRGB does. @default true */
  fireChangedOnLoad?: boolean;
}

const DEVTOOLS_MODES: readonly DevtoolsMode[] = ['none', 'minimal', 'full'];

/** Options for `srgbEffect()`: the effect manifest plus build settings. */
export interface SrgbEffectOptions extends EffectManifest {
  /**
   * Generated globals typings, relative to the Vite root. Generated on every `vite` and `vite build`; add it to `.gitignore`.
   * @default 'src/srgb-effect.d.ts'
   */
  typesFile?: string;
  /**
   * Output file name: a plain name ending in `.html`, without directories.
   * @default kebab-cased title + '.html'
   */
  fileName?: string;
  /**
   * `'module'` (the default) emits one inline `<script type="module">`, which allows external
   * imports, top-level await and `import.meta`. `'classic'` is opt-in for engines that cannot run
   * module scripts: it bundles the effect as a strict-mode IIFE in a plain `<script>` and rejects
   * those three features.
   * @default 'module'
   */
  script?: 'classic' | 'module';
  /**
   * Strip `console.*` and `debugger` from the build (SignalRGB requires a clean console). Also
   * minifies the script, even with `build.minify: false`. @default true
   */
  dropConsole?: boolean;
  /** Build target. Provisional until probed. @default 'es2020' */
  target?: string | string[];
  /**
   * SignalRGB simulation in `vite` dev, never part of the build: a mode (`'none'`, `'minimal'` or
   * `'full'`, see {@link DevtoolsMode}) or `{ mode, fireChangedOnLoad }`. A string means
   * `{ mode, fireChangedOnLoad: true }`. @default 'full'
   */
  devtools?: DevtoolsMode | DevtoolsOptions;
}

/** `SrgbEffectOptions` with defaults applied, split into the manifest and plugin settings. */
export interface ResolvedOptions {
  manifest: EffectManifest;
  typesFile: string;
  fileName: string;
  script: 'classic' | 'module';
  dropConsole: boolean;
  target: string | string[];
  devtools: Required<DevtoolsOptions>;
}

/** Resolves the `devtools` option, rejecting anything but a mode or the object form. */
function resolveDevtools(devtools: unknown): Required<DevtoolsOptions> {
  const options: unknown = typeof devtools === 'string' ? { mode: devtools } : devtools;
  if (typeof options === 'object' && options !== null) {
    const { mode = 'full', fireChangedOnLoad = true } = options as DevtoolsOptions;
    if (DEVTOOLS_MODES.includes(mode) && typeof fireChangedOnLoad === 'boolean') {
      return { mode, fireChangedOnLoad };
    }
  }
  throw new Error(
    `[srgb-effect] devtools must be 'none', 'minimal', 'full' or { mode, fireChangedOnLoad } (got ${JSON.stringify(devtools)})`,
  );
}

/**
 * Applies defaults and splits plugin settings from the manifest.
 * @throws Error when `fileName` does not end in `.html` or contains a path separator, or when
 * `devtools` is not a mode or `{ mode?, fireChangedOnLoad? }` (for example the old `true`/`false`).
 */
export function resolveOptions(options: SrgbEffectOptions): ResolvedOptions {
  const {
    typesFile = 'src/srgb-effect.d.ts',
    fileName,
    script = 'module',
    dropConsole = true,
    target = 'es2020',
    devtools = 'full',
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
    devtools: resolveDevtools(devtools),
  };
}
