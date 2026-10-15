# srgb-effect-kit Core (Plan 1 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a usable `srgb-effect-kit` package. It has two parts:
- a Vite plugin that turns a typed manifest in `vite.config.ts` into SignalRGB `<meta>` tags, committed global typings and a single-file HTML build;
- browser runtime utilities.

Two example effects prove it end to end.

**Architecture:** The repo is a pnpm workspace. It has one published package, `packages/srgb-effect-kit`, and examples under `examples/*`.
- `src/shared/` is isomorphic. It holds the manifest types, validation, the meta serializer, typegen and prelude generation.
- `src/runtime/` holds the browser utilities and is exported as `srgb-effect-kit`.
- `src/vite/` holds the plugin and is exported as `srgb-effect-kit/vite`.
- `client.d.ts` holds ambient SignalRGB globals and is exported as `srgb-effect-kit/client`.

The build relies on Rolldown's IIFE output and `codeSplitting: false`. A `generateBundle` pass then inlines JS and CSS and injects the head markup with string operations.

**Tech Stack:** TypeScript ~6.0, Vite 8 (Rolldown), tsdown 0.23, vitest 5, jsdom, pnpm 10 workspaces, ESLint 10 + typescript-eslint, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-13-srgb-effect-kit-design.md`

**Scope:** This is Plan 1 of 3.
- Plan 2 covers devtools (spec §10). It consumes `ResolvedOptions.devtools`, `generatePrelude`, `serializeHead` and `injectIntoHead` from this plan.
- Plan 3 covers the probe effect (spec §9).

Not in this plan: the devtools drawer and mocks, dev-server endpoints, and the probe.

## Global Constraints

- Package name: `srgb-effect-kit`. Exports: `.` (runtime), `./vite` (plugin), `./client` (types only).
- ESM-only package (`"type": "module"`). `vite` is a **peer** dependency `^8.0.0`. The runtime has **zero** dependencies.
- TypeScript `~6.0.3`. typescript-eslint 8.71 requires `<6.1`, so do not use TS 7.
- Node `26.2.0` via `mise.toml`, and pnpm `10.34.6` via `packageManager`.
- `src/runtime/**` and `src/shared/**` must not import `node:*`, `vite` or `src/vite/**`. `src/shared/**` must not import `src/runtime/**` either. ESLint enforces both rules.
- Properties and meters are **arrays**: array order is emitted order.
- Handler naming: `on` + the property with its first letter uppercased + `Changed` (`speed` → `onSpeedChanged`).
- Plugin option defaults:

  | Option | Default |
  |---|---|
  | `typesFile` | `'src/srgb-effect.d.ts'` |
  | `fileName` | kebab-cased title + `.html` |
  | `script` | `'classic'` |
  | `dropConsole` | `true` |
  | `target` | `'es2020'` |
  | `devtools` | `true` |
  | `fireChangedOnLoad` | `true` |
- Provisional raw boolean type: `SRGBBoolean = '0' | '1'`.
- Do not validate canvas presence or size anywhere.
- The generated `.d.ts` is **committed**. It is written only when its content changes.
- All error and warning messages start with `[srgb-effect]`.
- Every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Special characters in user strings.** Labels, tooltips, titles and list values may contain `"`, `&`, `<` or `>`. They must be HTML-escaped in the generated head. *Test:* Task 4 serializer escaping test.
2. **`</script>` or `</style>` inside bundled code or CSS.** For example a string literal `'</script>'`. Without escaping it would terminate the inline tag early and break the effect. *Test:* Task 11 "escapes closing tags" build test.
3. **Docs-style `index.html` with no `<head>` and/or no `<html>` wrapper.** Head markup must still be injected and scripts placed. *Test:* Task 4 `injectIntoHead` fallbacks and the Task 11 "minimal html" build test.
4. **Property names that differ only in their first letter's case** (`speed` and `Speed`). Both map to `onSpeedChanged`, so validation must reject the pair. *Test:* Task 3 handler-collision test.
5. **Non-default Vite `base`** (`'./'` or `'/sub/'`). Emitted script and link URLs change shape, and the inliner must still resolve them. *Test:* Task 11 "base ./" build test.

---

## File Map

```text
.
├─ package.json                      root, private: workspace scripts + lint tooling
├─ pnpm-workspace.yaml
├─ mise.toml
├─ tsconfig.base.json
├─ eslint.config.js
├─ .prettierrc.json / .prettierignore / .gitignore
├─ .github/workflows/ci.yml
├─ packages/srgb-effect-kit/
│  ├─ package.json / tsconfig.json / tsdown.config.ts / vitest.config.ts
│  ├─ client.d.ts                    ambient globals (engine, onCanvasApiEvent, SRGBVision, SRGBBoolean)
│  ├─ README.md
│  ├─ scripts/generate-reserved-globals.ts
│  ├─ test/helpers/fixture.ts        temp-dir Vite fixtures for plugin tests
│  └─ src/
│     ├─ shared/  names.ts types.ts reservedGlobals.generated.ts validate.ts
│     │           serialize.ts html.ts typegen.ts prelude.ts index.ts (+ *.test.ts)
│     ├─ runtime/ types.ts engine.ts boolean.ts renderer.ts canvas.ts color.ts
│     │           loop.ts audio.ts zones.ts meter.ts index.ts (+ *.test.ts)
│     └─ vite/    options.ts fs.ts corePlugin.ts inline.ts buildPlugin.ts
│                 moduleScopePlugin.ts index.ts (+ *.test.ts, index.test-d.ts)
└─ examples/
   ├─ basic-2d/          package.json tsconfig.json vite.config.ts index.html src/main.ts src/srgb-effect.d.ts
   └─ audio-visualizer/  (same layout)
```

---

### Task 1: Workspace scaffold + name helpers

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `mise.toml`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.gitignore`, `.github/workflows/ci.yml`
- Create: `packages/srgb-effect-kit/package.json`, `packages/srgb-effect-kit/tsconfig.json`, `packages/srgb-effect-kit/tsdown.config.ts`, `packages/srgb-effect-kit/vitest.config.ts`
- Create: `packages/srgb-effect-kit/src/shared/names.ts`
- Test: `packages/srgb-effect-kit/src/shared/names.test.ts`

**Interfaces:**
- Produces:
  - `handlerName(property: string): string`
  - `kebabCase(input: string): string`

- [ ] **Step 1: Create root config files**

`package.json`:
```json
{
  "name": "srgb-effect-toolkit",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "eslint .",
    "format": "prettier --check .",
    "format:fix": "prettier --write ."
  },
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "eslint": "^10.12.0",
    "eslint-config-prettier": "^10.1.8",
    "globals": "^17.13.0",
    "prettier": "^3.9.10",
    "typescript": "~6.0.3",
    "typescript-eslint": "^8.71.2"
  },
  "packageManager": "pnpm@10.34.6"
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - packages/*
  - examples/*
```

`mise.toml`:
```toml
[tools]
node = "26.2.0"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  }
}
```

`eslint.config.js`:
```js
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const NODE_AND_VITE = ['node:*', 'vite', 'vite/*', '**/vite/**', '**/devtools/**'];

export default defineConfig(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts', '**/*.generated.ts'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['packages/srgb-effect-kit/src/runtime/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: NODE_AND_VITE,
              message: 'runtime/ ships inside effects: no Node, Vite or devtools imports.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/srgb-effect-kit/src/shared/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [...NODE_AND_VITE, '**/runtime/**'],
              message: 'shared/ is isomorphic: no Node, Vite, runtime or devtools imports.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
```

`.prettierrc.json`:
```json
{ "singleQuote": true, "printWidth": 100, "trailingComma": "all" }
```

`.prettierignore`:
```text
dist
pnpm-lock.yaml
**/*.generated.ts
**/srgb-effect.d.ts
```

`.gitignore`:
```text
node_modules
dist
coverage
*.log
.DS_Store
```

`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 26.2.0
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm format
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm test
```
(`build` runs before `typecheck` because the examples type-check against the built `dist/` of the kit.)

- [ ] **Step 2: Create package config files**

`packages/srgb-effect-kit/package.json`:
```json
{
  "name": "srgb-effect-kit",
  "version": "0.0.0",
  "description": "Vite plugin and utilities for building SignalRGB effects",
  "license": "MIT",
  "type": "module",
  "files": ["dist", "client.d.ts"],
  "exports": {
    ".": { "types": "./dist/runtime/index.d.ts", "default": "./dist/runtime/index.js" },
    "./vite": { "types": "./dist/vite/index.d.ts", "default": "./dist/vite/index.js" },
    "./client": { "types": "./client.d.ts" },
    "./package.json": "./package.json"
  },
  "scripts": {
    "build": "node -e \"require('node:fs').rmSync('dist',{recursive:true,force:true})\" && tsdown",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "generate:reserved-globals": "node scripts/generate-reserved-globals.ts"
  },
  "peerDependencies": { "vite": "^8.0.0" },
  "devDependencies": {
    "@types/node": "^26.6.5",
    "jsdom": "^30.1.2",
    "tsdown": "^0.23.1",
    "typescript": "~6.0.3",
    "vite": "^8.3.4",
    "vitest": "^5.0.4"
  },
  "engines": { "node": ">=22.12.0" }
}
```

`packages/srgb-effect-kit/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"]
  },
  "include": ["src", "test", "scripts", "*.ts"]
}
```

`packages/srgb-effect-kit/tsdown.config.ts`:
```ts
import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: { 'runtime/index': 'src/runtime/index.ts' },
    platform: 'browser',
    format: 'esm',
    dts: true,
    fixedExtension: false,
    clean: false,
  },
  {
    entry: { 'vite/index': 'src/vite/index.ts' },
    platform: 'node',
    format: 'esm',
    dts: true,
    fixedExtension: false,
    clean: false,
  },
]);
```

`packages/srgb-effect-kit/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 3: Install dependencies**

Run: `pnpm install`
Expected: the lockfile is created and no errors are reported.

- [ ] **Step 4: Write the failing test**

`packages/srgb-effect-kit/src/shared/names.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { handlerName, kebabCase } from './names';

describe('handlerName', () => {
  it('capitalizes the first letter and wraps with on…Changed', () => {
    expect(handlerName('speed')).toBe('onSpeedChanged');
    expect(handlerName('RGBModeEnabled')).toBe('onRGBModeEnabledChanged');
    expect(handlerName('x')).toBe('onXChanged');
  });
});

describe('kebabCase', () => {
  it('converts titles to file-safe kebab case', () => {
    expect(kebabCase('Hue Cycle')).toBe('hue-cycle');
    expect(kebabCase('Butterchurn SRGB')).toBe('butterchurn-srgb');
    expect(kebabCase('myEffect v2!')).toBe('my-effect-v2');
    expect(kebabCase('  Café  Lights ')).toBe('cafe-lights');
  });

  it('falls back to "effect" when nothing usable remains', () => {
    expect(kebabCase('!!!')).toBe('effect');
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `pnpm --filter srgb-effect-kit test`
Expected: FAIL, because `./names` cannot be resolved.

- [ ] **Step 6: Implement**

`packages/srgb-effect-kit/src/shared/names.ts`:
```ts
/** Name of the global change handler SignalRGB calls for a property. */
export const handlerName = (property: string): string =>
  `on${property.charAt(0).toUpperCase()}${property.slice(1)}Changed`;

export const kebabCase = (input: string): string =>
  input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'effect';
```

- [ ] **Step 7: Run tests, lint and typecheck**

Run: `pnpm --filter srgb-effect-kit test && pnpm lint && pnpm --filter srgb-effect-kit typecheck`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold workspace and srgb-effect-kit package" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Manifest types

**Files:**
- Create: `packages/srgb-effect-kit/src/shared/types.ts`
- Test: `packages/srgb-effect-kit/src/shared/types.test-d.ts` (compile-time only; checked by `tsc`)

**Interfaces:**
- Produces (used by every later shared/vite task):
  - `Range`, `HslRanges`
  - `NumberProperty`, `HueProperty`, `BooleanProperty`, `ColorProperty`, `TextfieldProperty`, `ListProperty`, `PropertyDef`, `PropertyType`
  - `ResolutionDef`
  - `LinearMeter`, `AreaMeter`, `OcrTextMatchMeter`, `OcrNumericMeter`, `MeterDef`, `MeterType`
  - `EffectManifest`

- [ ] **Step 1: Write the failing type test**

`packages/srgb-effect-kit/src/shared/types.test-d.ts`:
```ts
import type { EffectManifest, MeterDef, PropertyDef } from './types';

export const ok: EffectManifest = {
  title: 'Hue Cycle',
  description: 'Rainbow wave',
  publisher: 'ferret',
  properties: [
    { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
    { property: 'hue', type: 'hue', label: 'Hue', default: 120 },
    { property: 'on', type: 'boolean', label: 'On', default: true },
    { property: 'tint', type: 'color', label: 'Tint', default: '#009bde' },
    { property: 'text', type: 'textfield', label: 'Text', default: '' },
    { property: 'mode', type: 'list', label: 'Mode', values: ['A', 'B'], default: 'A' },
  ],
  meters: [
    { meter: 'a', type: 'linear', x: 0, y: 0, width: 0.1, h: [0, 360], s: [0, 100], l: [0, 100] },
    { meter: 'b', type: 'area', x: 0, y: 0, width: 0.1, height: 0.1, h: [0, 1], s: [0, 1], l: [0, 1] },
    { meter: 'c', type: 'ocr_textmatch', x: 0, y: 0, width: 0.1, height: 0.1, string: 'GO' },
    {
      meter: 'd',
      type: 'ocr_numeric',
      x: 0,
      y: 0,
      width: 0.1,
      height: 0.1,
      confidence: 80,
      resolutions: [{ size: '1920x1080', x: 0.2 }, { aspect: '21:9' }],
    },
  ],
};

// @ts-expect-error number properties require min and max
export const missingMin: PropertyDef = { property: 'a', type: 'number', label: 'A', default: 1 };

// @ts-expect-error linear meters have no height
export const linearHeight: MeterDef = { meter: 'a', type: 'linear', x: 0, y: 0, width: 0.1, height: 0.1, h: [0, 1], s: [0, 1], l: [0, 1] };

// @ts-expect-error a resolution cannot have both size and aspect
export const both: MeterDef = { meter: 'a', type: 'ocr_numeric', x: 0, y: 0, width: 0.1, height: 0.1, resolutions: [{ size: '1x1', aspect: '1:1' }] };
```

- [ ] **Step 2: Run typecheck to verify it fails**

Run: `pnpm --filter srgb-effect-kit typecheck`
Expected: FAIL, with "Cannot find module './types'".

- [ ] **Step 3: Implement**

`packages/srgb-effect-kit/src/shared/types.ts`:
```ts
/** Inclusive `[min, max]` range, serialized as `"min-max"`. */
export type Range = readonly [min: number, max: number];

interface BaseProperty<T extends string, D> {
  /** Global variable name SignalRGB injects. */
  property: string;
  type: T;
  label: string;
  default: D;
  tooltip?: string;
}

export interface NumberProperty extends BaseProperty<'number', number> {
  min: number;
  max: number;
}
export interface HueProperty extends BaseProperty<'hue', number> {
  /** @default 0 */
  min?: number;
  /** @default 360 */
  max?: number;
}
export type BooleanProperty = BaseProperty<'boolean', boolean>;
/** `default` is `#rrggbb`. */
export type ColorProperty = BaseProperty<'color', string>;
export type TextfieldProperty = BaseProperty<'textfield', string>;
export interface ListProperty extends BaseProperty<'list', string> {
  values: readonly string[];
}

export type PropertyDef =
  | NumberProperty
  | HueProperty
  | BooleanProperty
  | ColorProperty
  | TextfieldProperty
  | ListProperty;
export type PropertyType = PropertyDef['type'];

export interface HslRanges {
  /** 0–360 */
  h: Range;
  /** 0–100 */
  s: Range;
  /** 0–100 */
  l: Range;
}

interface ResolutionRegion {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}
export type ResolutionDef = ResolutionRegion &
  (
    | { size: `${number}x${number}`; aspect?: never }
    | { aspect: `${number}:${number}`; size?: never }
  );

interface BaseMeter<T extends string> {
  /** Readable as `engine.vision.<meter>`. */
  meter: string;
  type: T;
  /** Normalized 0–1 from the top-left of the screen. */
  x: number;
  y: number;
  tags?: readonly string[];
  resolutions?: readonly ResolutionDef[];
}

export interface LinearMeter extends BaseMeter<'linear'>, HslRanges {
  width: number;
  hdr?: HslRanges;
}
export interface AreaMeter extends BaseMeter<'area'>, HslRanges {
  width: number;
  height: number;
  hdr?: HslRanges;
}
export interface OcrTextMatchMeter extends BaseMeter<'ocr_textmatch'> {
  width: number;
  height: number;
  string: string;
  /** 0–100, @default 70 */
  confidence?: number;
}
export interface OcrNumericMeter extends BaseMeter<'ocr_numeric'> {
  width: number;
  height: number;
  /** 0–100, @default 70 */
  confidence?: number;
}

export type MeterDef = LinearMeter | AreaMeter | OcrTextMatchMeter | OcrNumericMeter;
export type MeterType = MeterDef['type'];

export interface EffectManifest {
  title: string;
  description?: string;
  publisher?: string;
  properties?: readonly PropertyDef[];
  meters?: readonly MeterDef[];
}
```

- [ ] **Step 4: Run typecheck to verify it passes**

Run: `pnpm --filter srgb-effect-kit typecheck`
Expected: PASS. This includes the three `@ts-expect-error` lines: each must actually error, or tsc reports "Unused '@ts-expect-error' directive".

If `linearHeight` does **not** error, TypeScript is not applying excess-property checks across the union. In that case add `height?: never;` to `LinearMeter` and re-run.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/shared/types.ts packages/srgb-effect-kit/src/shared/types.test-d.ts
git commit -m "feat(shared): add effect manifest types" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Reserved globals + manifest validation

**Files:**
- Create: `packages/srgb-effect-kit/scripts/generate-reserved-globals.ts`
- Create (generated, committed): `packages/srgb-effect-kit/src/shared/reservedGlobals.generated.ts`
- Create: `packages/srgb-effect-kit/src/shared/validate.ts`
- Test: `packages/srgb-effect-kit/src/shared/validate.test.ts`

**Interfaces:**
- Consumes:
  - `handlerName` (Task 1)
  - `EffectManifest`, `PropertyDef`, `MeterDef`, `Range`, `HslRanges` (Task 2)
- Produces:
  - `RESERVED_GLOBALS: ReadonlySet<string>`
  - `class ManifestError extends Error { issues: string[] }`
  - `collectManifestIssues(manifest: EffectManifest): string[]`
  - `assertValidManifest(manifest: EffectManifest): void` (throws `ManifestError`)

- [ ] **Step 1: Write the generator script**

`packages/srgb-effect-kit/scripts/generate-reserved-globals.ts`:
```ts
// Collects every global name declared by TypeScript's DOM and ES lib files.
// Effect properties become window globals, so these names are off-limits.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const libDir = path.dirname(require.resolve('typescript'));
const { version } = require('typescript/package.json') as { version: string };

const LIB_FILE = /^lib\.(?:dom|es5|es6|es\d{4}|esnext)(?:\.[a-z0-9.]+)?\.d\.ts$/i;
const DECLARATION = /^declare\s+(?:var|let|const|function|namespace|class)\s+([A-Za-z_$][\w$]*)/gm;

const names = new Set<string>(['globalThis', 'undefined']);
for (const file of fs.readdirSync(libDir).filter((f) => LIB_FILE.test(f))) {
  const source = fs.readFileSync(path.join(libDir, file), 'utf8');
  for (const match of source.matchAll(DECLARATION)) names.add(match[1]!);
}

const sorted = [...names].sort();
const out = `// Generated by scripts/generate-reserved-globals.ts from TypeScript ${version} lib files. Do not edit.
export const RESERVED_GLOBALS: ReadonlySet<string> = new Set(${JSON.stringify(sorted, null, 2)});
`;
fs.writeFileSync(new URL('../src/shared/reservedGlobals.generated.ts', import.meta.url), out);
console.log(`Wrote ${sorted.length} reserved globals`);
```

- [ ] **Step 2: Generate the file**

Run: `pnpm --filter srgb-effect-kit generate:reserved-globals`
Expected: `Wrote <N> reserved globals`, with N > 800.

Then check a few names: `grep -c '"name"\|"status"\|"top"\|"close"\|"Math"\|"document"' packages/srgb-effect-kit/src/shared/reservedGlobals.generated.ts`
Expected: `6`.

- [ ] **Step 3: Write the failing tests**

`packages/srgb-effect-kit/src/shared/validate.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { EffectManifest, MeterDef, PropertyDef } from './types';
import { ManifestError, assertValidManifest, collectManifestIssues } from './validate';

const withProps = (...properties: PropertyDef[]): EffectManifest => ({ title: 'T', properties });
const withMeters = (...meters: MeterDef[]): EffectManifest => ({ title: 'T', meters });
const linear = (over: Partial<Extract<MeterDef, { type: 'linear' }>> = {}): MeterDef => ({
  meter: 'm',
  type: 'linear',
  x: 0.1,
  y: 0.1,
  width: 0.2,
  h: [0, 360],
  s: [0, 100],
  l: [0, 100],
  ...over,
});
const issues = (m: EffectManifest) => collectManifestIssues(m);

describe('collectManifestIssues', () => {
  it('accepts a valid manifest', () => {
    expect(
      issues({
        title: 'Hue Cycle',
        properties: [
          { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
          { property: 'baseHue', type: 'hue', label: 'Hue', default: 360 },
          { property: 'rainbow', type: 'boolean', label: 'Rainbow', default: true },
          { property: 'tint', type: 'color', label: 'Tint', default: '#00FFaa' },
          { property: 'text', type: 'textfield', label: 'Text', default: '' },
          { property: 'mode', type: 'list', label: 'Mode', values: ['A', 'B'], default: 'B' },
        ],
        meters: [linear({ resolutions: [{ size: '1920x1080', x: 0.5 }, { aspect: '3.55:1' }] })],
      }),
    ).toEqual([]);
  });

  it('rejects an empty title', () => {
    expect(issues({ title: '  ' })).toEqual(['title: must not be empty']);
  });

  describe('property names', () => {
    const num = (property: string): PropertyDef => ({
      property,
      type: 'number',
      label: 'L',
      min: 0,
      max: 1,
      default: 0,
    });

    it('requires valid identifiers', () => {
      expect(issues(withProps(num('my-prop')))[0]).toMatch(/properties\[0\] \("my-prop"\): .*identifier/);
    });

    it('rejects duplicates', () => {
      expect(issues(withProps(num('a'), num('a')))).toContainEqual(
        expect.stringMatching(/properties\[1\] \("a"\): duplicate/),
      );
    });

    it('rejects browser and SignalRGB globals', () => {
      for (const name of ['name', 'status', 'top', 'length', 'close', 'engine', 'onCanvasApiEvent']) {
        expect(issues(withProps(num(name)))[0]).toMatch(/collides with a built-in global/);
      }
    });

    it('rejects names whose change handlers collide', () => {
      expect(issues(withProps(num('speed'), num('Speed')))).toContainEqual(
        expect.stringMatching(/properties\[1\] \("Speed"\): change handler onSpeedChanged collides with property "speed"/),
      );
    });

    it('requires a label', () => {
      expect(issues(withProps({ ...num('a'), label: ' ' }))[0]).toMatch(/label must not be empty/);
    });
  });

  it('checks number ranges and integers', () => {
    const base = { property: 'a', type: 'number', label: 'A' } as const;
    expect(issues(withProps({ ...base, min: 0, max: 10, default: 11 }))[0]).toMatch(/min ≤ default ≤ max/);
    expect(issues(withProps({ ...base, min: 10, max: 0, default: 5 }))[0]).toMatch(/min ≤ default ≤ max/);
    expect(issues(withProps({ ...base, min: 0, max: 10, default: 1.5 }))[0]).toMatch(/whole numbers/);
  });

  it('checks hue bounds with defaults 0..360', () => {
    const base = { property: 'h', type: 'hue', label: 'H' } as const;
    expect(issues(withProps({ ...base, default: 361 }))[0]).toMatch(/0 ≤ min ≤ default ≤ max ≤ 360/);
    expect(issues(withProps({ ...base, min: -1, default: 0 }))[0]).toMatch(/0 ≤ min ≤ default ≤ max ≤ 360/);
  });

  it('checks color hex format', () => {
    expect(issues(withProps({ property: 'c', type: 'color', label: 'C', default: 'red' }))[0]).toMatch(
      /#rrggbb/,
    );
  });

  it('checks list values and default', () => {
    const base = { property: 'l', type: 'list', label: 'L' } as const;
    expect(issues(withProps({ ...base, values: [], default: 'a' }))).toContainEqual(
      expect.stringMatching(/values must not be empty/),
    );
    expect(issues(withProps({ ...base, values: ['a', 'a'], default: 'a' }))[0]).toMatch(/duplicate value "a"/);
    expect(issues(withProps({ ...base, values: ['a,b'], default: 'a,b' }))[0]).toMatch(/must not contain commas/);
    expect(issues(withProps({ ...base, values: ['a'], default: 'z' }))[0]).toMatch(/default "z" is not one of values/);
  });

  describe('meters', () => {
    it('requires identifiers and unique names', () => {
      expect(issues(withMeters(linear({ meter: 'bad name' })))[0]).toMatch(/identifier/);
      expect(issues(withMeters(linear(), linear()))[0]).toMatch(/meters\[1\] \("m"\): duplicate/);
    });

    it('rejects regions outside the screen', () => {
      expect(issues(withMeters(linear({ x: 0.9, width: 0.2 })))[0]).toMatch(/x \+ width must be ≤ 1/);
      expect(issues(withMeters(linear({ y: 1.2 })))[0]).toMatch(/y must be between 0 and 1/);
      expect(
        issues(
          withMeters({ meter: 'a', type: 'area', x: 0, y: 0.95, width: 0.1, height: 0.1, h: [0, 1], s: [0, 1], l: [0, 1] }),
        )[0],
      ).toMatch(/y \+ height must be ≤ 1/);
    });

    it('allows float sums that are exactly 1', () => {
      expect(issues(withMeters(linear({ x: 0.7, width: 0.3 })))).toEqual([]);
    });

    it('checks HSL ranges including hdr', () => {
      expect(issues(withMeters(linear({ h: [0, 400] })))[0]).toMatch(/h range must satisfy 0 ≤ min ≤ max ≤ 360/);
      expect(issues(withMeters(linear({ s: [50, 10] })))[0]).toMatch(/s range/);
      expect(issues(withMeters(linear({ hdr: { h: [0, 1], s: [0, 1], l: [0, 101] } })))[0]).toMatch(/hdr: l range/);
    });

    it('checks OCR string and confidence', () => {
      const ocr = { meter: 'o', type: 'ocr_textmatch', x: 0, y: 0, width: 0.1, height: 0.1 } as const;
      expect(issues(withMeters({ ...ocr, string: '' }))[0]).toMatch(/string must not be empty/);
      expect(issues(withMeters({ ...ocr, string: 'GO', confidence: 101 }))[0]).toMatch(/confidence/);
    });

    it('checks resolutions after merging with the base region', () => {
      expect(issues(withMeters(linear({ resolutions: [{ size: '1920x1080', x: 0.9 }] })))[0]).toMatch(
        /resolutions\[0\]: x \+ width must be ≤ 1/,
      );
      expect(issues(withMeters(linear({ resolutions: [{ size: '1920*1080' as '1x1' }] })))[0]).toMatch(
        /size must look like "1920x1080"/,
      );
      expect(issues(withMeters(linear({ resolutions: [{ aspect: '16-9' as '1:1' }] })))[0]).toMatch(
        /aspect must look like "16:9"/,
      );
      expect(issues(withMeters(linear({ resolutions: [{} as { size: '1x1' }] })))[0]).toMatch(
        /exactly one of size or aspect/,
      );
    });
  });
});

describe('assertValidManifest', () => {
  it('throws a ManifestError listing every issue', () => {
    try {
      assertValidManifest({ title: '', properties: [{ property: 'name', type: 'color', label: 'C', default: 'x' }] });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestError);
      const { issues: list, message } = error as ManifestError;
      expect(list).toHaveLength(3);
      expect(message).toMatch(/^\[srgb-effect\] Invalid effect manifest:\n {2}- title/);
    }
  });

  it('does not throw for a valid manifest', () => {
    expect(() => assertValidManifest({ title: 'Ok' })).not.toThrow();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/shared/validate.test.ts`
Expected: FAIL, because `./validate` cannot be resolved.

- [ ] **Step 5: Implement**

`packages/srgb-effect-kit/src/shared/validate.ts`:
```ts
import { handlerName } from './names';
import { RESERVED_GLOBALS } from './reservedGlobals.generated';
import type { EffectManifest, HslRanges, MeterDef, PropertyDef, Range } from './types';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SIZE = /^\d+x\d+$/;
const ASPECT = /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/;
const SRGB_GLOBALS = new Set(['engine', 'onCanvasApiEvent']);
const EPSILON = 1e-9;

export class ManifestError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`[srgb-effect] Invalid effect manifest:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ManifestError';
    this.issues = issues;
  }
}

export function collectManifestIssues(manifest: EffectManifest): string[] {
  const issues: string[] = [];
  if (!manifest.title.trim()) issues.push('title: must not be empty');
  checkProperties(manifest.properties ?? [], issues);
  checkMeters(manifest.meters ?? [], issues);
  return issues;
}

export function assertValidManifest(manifest: EffectManifest): void {
  const issues = collectManifestIssues(manifest);
  if (issues.length > 0) throw new ManifestError(issues);
}

function checkProperties(properties: readonly PropertyDef[], issues: string[]): void {
  const names = new Set<string>();
  const handlers = new Map<string, string>();

  properties.forEach((p, i) => {
    const at = `properties[${i}] ("${p.property}")`;
    if (!IDENTIFIER.test(p.property)) issues.push(`${at}: property must be a valid JavaScript identifier`);
    if (names.has(p.property)) issues.push(`${at}: duplicate property name`);
    names.add(p.property);
    if (RESERVED_GLOBALS.has(p.property) || SRGB_GLOBALS.has(p.property)) {
      issues.push(`${at}: "${p.property}" collides with a built-in global; SignalRGB injects properties as window globals`);
    }
    const handler = handlerName(p.property);
    const owner = handlers.get(handler);
    if (owner !== undefined && owner !== p.property) {
      issues.push(`${at}: change handler ${handler} collides with property "${owner}"`);
    }
    handlers.set(handler, p.property);
    if (!p.label.trim()) issues.push(`${at}: label must not be empty`);

    switch (p.type) {
      case 'number':
        if (![p.min, p.max, p.default].every(Number.isInteger)) {
          issues.push(`${at}: min, max and default must be whole numbers`);
        } else if (!(p.min <= p.default && p.default <= p.max)) {
          issues.push(`${at}: must satisfy min ≤ default ≤ max (got ${p.min} ≤ ${p.default} ≤ ${p.max})`);
        }
        break;
      case 'hue': {
        const min = p.min ?? 0;
        const max = p.max ?? 360;
        if (!(min >= 0 && min <= p.default && p.default <= max && max <= 360)) {
          issues.push(`${at}: must satisfy 0 ≤ min ≤ default ≤ max ≤ 360 (got ${min}, ${p.default}, ${max})`);
        }
        break;
      }
      case 'boolean':
        if (typeof p.default !== 'boolean') issues.push(`${at}: default must be a boolean`);
        break;
      case 'color':
        if (!HEX_COLOR.test(p.default)) issues.push(`${at}: default must be a #rrggbb hex color (got "${p.default}")`);
        break;
      case 'textfield':
        if (typeof p.default !== 'string') issues.push(`${at}: default must be a string`);
        break;
      case 'list': {
        if (p.values.length === 0) issues.push(`${at}: values must not be empty`);
        const seen = new Set<string>();
        for (const value of p.values) {
          if (seen.has(value)) issues.push(`${at}: duplicate value "${value}"`);
          seen.add(value);
          if (value.includes(',')) issues.push(`${at}: value "${value}" must not contain commas (SignalRGB separates values with commas)`);
        }
        if (!p.values.includes(p.default)) issues.push(`${at}: default "${p.default}" is not one of values`);
        break;
      }
    }
  });
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

function checkMeters(meters: readonly MeterDef[], issues: string[]): void {
  const names = new Set<string>();

  meters.forEach((m, i) => {
    const at = `meters[${i}] ("${m.meter}")`;
    if (!IDENTIFIER.test(m.meter)) issues.push(`${at}: meter must be a valid JavaScript identifier`);
    if (names.has(m.meter)) issues.push(`${at}: duplicate meter name`);
    names.add(m.meter);

    const width = m.width;
    const height = m.type === 'linear' ? 0 : m.height;
    checkRegion(at, { x: m.x, y: m.y, width, height }, issues);

    if (m.type === 'linear' || m.type === 'area') {
      checkHsl(at, m, issues);
      if (m.hdr) checkHsl(`${at} hdr`, m.hdr, issues);
    }
    if (m.type === 'ocr_textmatch' && !m.string) issues.push(`${at}: string must not be empty`);
    if ((m.type === 'ocr_textmatch' || m.type === 'ocr_numeric') && m.confidence !== undefined) {
      if (!(m.confidence >= 0 && m.confidence <= 100)) issues.push(`${at}: confidence must be between 0 and 100`);
    }

    m.resolutions?.forEach((r, j) => {
      const rat = `${at} resolutions[${j}]`;
      if ((r.size === undefined) === (r.aspect === undefined)) {
        issues.push(`${rat}: exactly one of size or aspect is required`);
      }
      if (r.size !== undefined && !SIZE.test(r.size)) {
        issues.push(`${rat}: size must look like "1920x1080" (got "${r.size}")`);
      }
      if (r.aspect !== undefined && !ASPECT.test(r.aspect)) {
        issues.push(`${rat}: aspect must look like "16:9" (got "${r.aspect}")`);
      }
      checkRegion(
        rat,
        { x: r.x ?? m.x, y: r.y ?? m.y, width: r.width ?? width, height: r.height ?? height },
        issues,
      );
    });
  });
}

function checkRegion(at: string, region: Region, issues: string[]): void {
  let inBounds = true;
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const value = region[key];
    if (!(Number.isFinite(value) && value >= 0 && value <= 1)) {
      issues.push(`${at}: ${key} must be between 0 and 1 (got ${value})`);
      inBounds = false;
    }
  }
  if (!inBounds) return;
  if (region.x + region.width > 1 + EPSILON) {
    issues.push(`${at}: x + width must be ≤ 1 (meters outside the screen crash SignalRGB)`);
  }
  if (region.y + region.height > 1 + EPSILON) {
    issues.push(`${at}: y + height must be ≤ 1 (meters outside the screen crash SignalRGB)`);
  }
}

function checkHsl(at: string, ranges: HslRanges, issues: string[]): void {
  checkRange(at, 'h', ranges.h, 360, issues);
  checkRange(at, 's', ranges.s, 100, issues);
  checkRange(at, 'l', ranges.l, 100, issues);
}

function checkRange(at: string, key: string, [min, max]: Range, limit: number, issues: string[]): void {
  if (!(min >= 0 && min <= max && max <= limit)) {
    issues.push(`${at}: ${key} range must satisfy 0 ≤ min ≤ max ≤ ${limit} (got ${min}-${max})`);
  }
}
```

The `hdr` issue message reads `meters[0] ("m") hdr: l range …`, which matches the test's `/hdr: l range/`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter srgb-effect-kit test src/shared/validate.test.ts && pnpm lint && pnpm --filter srgb-effect-kit typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/srgb-effect-kit/scripts packages/srgb-effect-kit/src/shared
git commit -m "feat(shared): validate effect manifests" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Meta serializer + HTML helpers

**Files:**
- Create: `packages/srgb-effect-kit/src/shared/serialize.ts`, `packages/srgb-effect-kit/src/shared/html.ts`
- Test: `packages/srgb-effect-kit/src/shared/serialize.test.ts`, `packages/srgb-effect-kit/src/shared/html.test.ts`

**Interfaces:**
- Consumes: the Task 2 types.
- Produces:
  - `escapeAttr(value: string): string`
  - `escapeText(value: string): string`
  - `serializeProperty(p: PropertyDef): string`
  - `serializeMeter(m: MeterDef): string`
  - `serializeHead(manifest: EffectManifest): string`
  - `injectIntoHead(html: string, markup: string): string`
  - `injectBeforeBodyEnd(html: string, markup: string): string`
  - `findForbiddenHeadTags(html: string): string[]`

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/shared/serialize.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { escapeAttr, serializeHead, serializeMeter, serializeProperty } from './serialize';

describe('serializeProperty', () => {
  it('serializes each control type with SignalRGB attribute order', () => {
    expect(
      serializeProperty({ property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50, tooltip: 'How fast' }),
    ).toBe('<meta property="speed" label="Speed" type="number" min="0" max="100" default="50" tooltip="How fast" />');
    expect(serializeProperty({ property: 'h', type: 'hue', label: 'Hue', default: 120 })).toBe(
      '<meta property="h" label="Hue" type="hue" min="0" max="360" default="120" />',
    );
    expect(serializeProperty({ property: 'b', type: 'boolean', label: 'B', default: true })).toBe(
      '<meta property="b" label="B" type="boolean" default="1" />',
    );
    expect(serializeProperty({ property: 'b', type: 'boolean', label: 'B', default: false })).toBe(
      '<meta property="b" label="B" type="boolean" default="0" />',
    );
    expect(serializeProperty({ property: 'c', type: 'color', label: 'C', default: '#009bde' })).toBe(
      '<meta property="c" label="C" type="color" min="0" max="360" default="#009bde" />',
    );
    expect(serializeProperty({ property: 't', type: 'textfield', label: 'T', default: '' })).toBe(
      '<meta property="t" label="T" type="textfield" default="" />',
    );
    expect(serializeProperty({ property: 'l', type: 'list', label: 'L', values: ['A', 'B c'], default: 'B c' })).toBe(
      '<meta property="l" label="L" type="list" values="A,B c" default="B c" />',
    );
  });

  it('escapes special characters', () => {
    expect(escapeAttr(`a"b&c<d>e`)).toBe('a&quot;b&amp;c&lt;d&gt;e');
    expect(
      serializeProperty({ property: 'l', type: 'list', label: 'Say "hi" & <go>', values: ['<a>', 'b&c'], default: 'b&c' }),
    ).toBe('<meta property="l" label="Say &quot;hi&quot; &amp; &lt;go&gt;" type="list" values="&lt;a&gt;,b&amp;c" default="b&amp;c" />');
  });
});

describe('serializeMeter', () => {
  it('serializes linear meters with tags and hdr', () => {
    expect(
      serializeMeter({
        meter: 'health',
        type: 'linear',
        tags: ['vlc', 'fortnite'],
        x: 0.05,
        y: 0.9,
        width: 0.189,
        h: [70, 140],
        s: [40, 100],
        l: [40, 100],
        hdr: { h: [0, 60], s: [80, 100], l: [80, 100] },
      }),
    ).toBe(
      '<meta meter="health" type="linear" tags="vlc,fortnite" x="0.05" y="0.9" width="0.189" h="70-140" s="40-100" l="40-100" hdr-h="0-60" hdr-s="80-100" hdr-l="80-100" />',
    );
  });

  it('serializes area and OCR meters with default confidence', () => {
    expect(serializeMeter({ meter: 'a', type: 'area', x: 0, y: 0, width: 0.1, height: 0.2, h: [0, 1], s: [2, 3], l: [4, 5] })).toBe(
      '<meta meter="a" type="area" x="0" y="0" width="0.1" height="0.2" h="0-1" s="2-3" l="4-5" />',
    );
    expect(serializeMeter({ meter: 't', type: 'ocr_textmatch', x: 0, y: 0, width: 0.1, height: 0.1, string: 'GO' })).toBe(
      '<meta meter="t" type="ocr_textmatch" x="0" y="0" width="0.1" height="0.1" string="GO" confidence="70" />',
    );
    expect(serializeMeter({ meter: 'n', type: 'ocr_numeric', x: 0, y: 0, width: 0.1, height: 0.1, confidence: 90 })).toBe(
      '<meta meter="n" type="ocr_numeric" x="0" y="0" width="0.1" height="0.1" confidence="90" />',
    );
  });

  it('writes non-void meta with resolution children', () => {
    expect(
      serializeMeter({
        meter: 'm',
        type: 'linear',
        x: 0.1,
        y: 0.2,
        width: 0.3,
        h: [0, 1],
        s: [0, 1],
        l: [0, 1],
        resolutions: [{ size: '1920x1080', x: 0.0557, width: 0.199 }, { aspect: '21:9', y: 0.5 }],
      }),
    ).toBe(
      [
        '<meta meter="m" type="linear" x="0.1" y="0.2" width="0.3" h="0-1" s="0-1" l="0-1">',
        '  <resolution size="1920x1080" x="0.0557" width="0.199" />',
        '  <resolution aspect="21:9" y="0.5" />',
        '</meta>',
      ].join('\n'),
    );
  });
});

describe('serializeHead', () => {
  it('emits title, description, publisher, properties then meters', () => {
    expect(
      serializeHead({
        title: 'A & B',
        description: 'Desc "q"',
        publisher: 'me',
        properties: [{ property: 'b', type: 'boolean', label: 'B', default: false }],
        meters: [{ meter: 'n', type: 'ocr_numeric', x: 0, y: 0, width: 0.1, height: 0.1 }],
      }),
    ).toBe(
      [
        '<title>A &amp; B</title>',
        '<meta description="Desc &quot;q&quot;" />',
        '<meta publisher="me" />',
        '<meta property="b" label="B" type="boolean" default="0" />',
        '<meta meter="n" type="ocr_numeric" x="0" y="0" width="0.1" height="0.1" confidence="70" />',
      ].join('\n'),
    );
  });

  it('omits missing optional metadata', () => {
    expect(serializeHead({ title: 'Only' })).toBe('<title>Only</title>');
  });
});
```

`packages/srgb-effect-kit/src/shared/html.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { findForbiddenHeadTags, injectBeforeBodyEnd, injectIntoHead } from './html';

describe('injectIntoHead', () => {
  it('inserts right after the opening head tag', () => {
    expect(injectIntoHead('<html><head lang="x"><style></style></head></html>', '<title>T</title>')).toBe(
      '<html><head lang="x">\n<title>T</title>\n<style></style></head></html>',
    );
  });

  it('creates a head after <html> when missing', () => {
    expect(injectIntoHead('<!doctype html><html><body></body></html>', 'M')).toBe(
      '<!doctype html><html><head>\nM\n</head>\n<body></body></html>',
    );
  });

  it('creates a head after the doctype when there is no html tag', () => {
    expect(injectIntoHead('<!DOCTYPE html>\n<body></body>', 'M')).toBe('<!DOCTYPE html><head>\nM\n</head>\n\n<body></body>');
  });

  it('prepends a head when there is nothing to anchor to', () => {
    expect(injectIntoHead('<body></body>', 'M')).toBe('<head>\nM\n</head>\n<body></body>');
  });

  it('does not match tags that merely start with "head"', () => {
    expect(injectIntoHead('<header></header>', 'M')).toBe('<head>\nM\n</head>\n<header></header>');
  });
});

describe('injectBeforeBodyEnd', () => {
  it('inserts before the last closing body tag', () => {
    expect(injectBeforeBodyEnd('<body><p></p></body>', '<script></script>')).toBe(
      '<body><p></p>\n<script></script>\n</body>',
    );
  });

  it('appends when there is no closing body tag', () => {
    expect(injectBeforeBodyEnd('<canvas></canvas>', 'S')).toBe('<canvas></canvas>\nS\n');
  });
});

describe('findForbiddenHeadTags', () => {
  it('finds title and SignalRGB meta tags', () => {
    expect(
      findForbiddenHeadTags('<head><title>x</title><meta property="a" type="number"><meta publisher="me"/></head>'),
    ).toEqual(['<title>', '<meta property>', '<meta publisher>']);
    expect(findForbiddenHeadTags('<meta meter="m" type="area">')).toEqual(['<meta meter>']);
    expect(findForbiddenHeadTags('<meta description="d">')).toEqual(['<meta description>']);
  });

  it('ignores commented-out tags and ordinary meta', () => {
    expect(
      findForbiddenHeadTags('<!-- <title>x</title> <meta property="a"> --><meta charset="utf-8"><meta name="viewport" content="x">'),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/shared/serialize.test.ts src/shared/html.test.ts`
Expected: FAIL, because the modules are not found.

- [ ] **Step 3: Implement**

`packages/srgb-effect-kit/src/shared/serialize.ts`:
```ts
import type { EffectManifest, MeterDef, PropertyDef, Range } from './types';

type Attr = readonly [name: string, value: string | number | undefined];

export const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const attrs = (list: readonly Attr[]): string =>
  list
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}="${escapeAttr(String(value))}"`)
    .join(' ');

const range = ([min, max]: Range): string => `${min}-${max}`;

export function serializeProperty(p: PropertyDef): string {
  const list: Attr[] = [
    ['property', p.property],
    ['label', p.label],
    ['type', p.type],
  ];
  switch (p.type) {
    case 'number':
      list.push(['min', p.min], ['max', p.max], ['default', p.default]);
      break;
    case 'hue':
      list.push(['min', p.min ?? 0], ['max', p.max ?? 360], ['default', p.default]);
      break;
    case 'boolean':
      list.push(['default', p.default ? '1' : '0']);
      break;
    case 'color':
      // SignalRGB's docs always pair color pickers with min="0" max="360".
      list.push(['min', 0], ['max', 360], ['default', p.default]);
      break;
    case 'textfield':
      list.push(['default', p.default]);
      break;
    case 'list':
      list.push(['values', p.values.join(',')], ['default', p.default]);
      break;
  }
  list.push(['tooltip', p.tooltip]);
  return `<meta ${attrs(list)} />`;
}

export function serializeMeter(m: MeterDef): string {
  const list: Attr[] = [
    ['meter', m.meter],
    ['type', m.type],
    ['tags', m.tags?.join(',')],
    ['x', m.x],
    ['y', m.y],
    ['width', m.width],
  ];
  if (m.type !== 'linear') list.push(['height', m.height]);
  if (m.type === 'linear' || m.type === 'area') {
    list.push(['h', range(m.h)], ['s', range(m.s)], ['l', range(m.l)]);
    if (m.hdr) list.push(['hdr-h', range(m.hdr.h)], ['hdr-s', range(m.hdr.s)], ['hdr-l', range(m.hdr.l)]);
  }
  if (m.type === 'ocr_textmatch') list.push(['string', m.string]);
  if (m.type === 'ocr_textmatch' || m.type === 'ocr_numeric') list.push(['confidence', m.confidence ?? 70]);

  const open = `<meta ${attrs(list)}`;
  if (!m.resolutions?.length) return `${open} />`;

  // SignalRGB requires resolution overrides between an explicit <meta> … </meta> pair.
  const children = m.resolutions.map(
    (r) =>
      `  <resolution ${attrs([
        ['size', r.size],
        ['aspect', r.aspect],
        ['x', r.x],
        ['y', r.y],
        ['width', r.width],
        ['height', r.height],
      ])} />`,
  );
  return [`${open}>`, ...children, '</meta>'].join('\n');
}

export function serializeHead(manifest: EffectManifest): string {
  const lines = [`<title>${escapeText(manifest.title)}</title>`];
  if (manifest.description !== undefined) lines.push(`<meta description="${escapeAttr(manifest.description)}" />`);
  if (manifest.publisher !== undefined) lines.push(`<meta publisher="${escapeAttr(manifest.publisher)}" />`);
  for (const p of manifest.properties ?? []) lines.push(serializeProperty(p));
  for (const m of manifest.meters ?? []) lines.push(serializeMeter(m));
  return lines.join('\n');
}
```

`packages/srgb-effect-kit/src/shared/html.ts`:
```ts
const HEAD_OPEN = /<head(?:\s[^>]*)?>/i;
const HTML_OPEN = /<html(?:\s[^>]*)?>/i;
const DOCTYPE = /<!doctype[^>]*>/i;
const BODY_CLOSE = /<\/body\s*>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;

const insertAt = (html: string, index: number, markup: string): string =>
  `${html.slice(0, index)}${markup}${html.slice(index)}`;

/** Inserts markup at the start of <head>, creating the element when the document has none. */
export function injectIntoHead(html: string, markup: string): string {
  const head = HEAD_OPEN.exec(html);
  if (head) return insertAt(html, head.index + head[0].length, `\n${markup}\n`);

  const block = `<head>\n${markup}\n</head>\n`;
  const anchor = HTML_OPEN.exec(html) ?? DOCTYPE.exec(html);
  if (anchor) return insertAt(html, anchor.index + anchor[0].length, block);
  return `${block}${html}`;
}

/** Inserts markup before the last </body>, or appends it when the document has none. */
export function injectBeforeBodyEnd(html: string, markup: string): string {
  let last: RegExpExecArray | undefined;
  for (const match of html.matchAll(BODY_CLOSE)) last = match as RegExpExecArray;
  if (!last) return `${html}\n${markup}\n`;
  return insertAt(html, last.index, `\n${markup}\n`);
}

const FORBIDDEN: readonly (readonly [label: string, pattern: RegExp])[] = [
  ['<title>', /<title[\s>]/i],
  ['<meta property>', /<meta\b[^>]*\sproperty\s*=/i],
  ['<meta meter>', /<meta\b[^>]*\smeter\s*=/i],
  ['<meta description>', /<meta\b[^>]*\sdescription\s*=/i],
  ['<meta publisher>', /<meta\b[^>]*\spublisher\s*=/i],
];

/** Tags that srgbEffect() generates and therefore must not be hand-written in index.html. */
export function findForbiddenHeadTags(html: string): string[] {
  const source = html.replace(COMMENT, '');
  return FORBIDDEN.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter srgb-effect-kit test src/shared && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/shared
git commit -m "feat(shared): serialize SignalRGB head markup" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Typegen + prelude + shared barrel

**Files:**
- Create: `packages/srgb-effect-kit/src/shared/typegen.ts`, `packages/srgb-effect-kit/src/shared/prelude.ts`, `packages/srgb-effect-kit/src/shared/index.ts`
- Test: `packages/srgb-effect-kit/src/shared/typegen.test.ts`, `packages/srgb-effect-kit/src/shared/prelude.test.ts`

**Interfaces:**
- Consumes:
  - `handlerName` (Task 1)
  - the Task 2 types
- Produces:
  - `generateTypes(manifest: EffectManifest): string`
  - `generatePrelude(manifest: EffectManifest): string`
  - a `shared/index.ts` barrel re-exporting everything in `shared/`

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/shared/typegen.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { generateTypes } from './typegen';

describe('generateTypes', () => {
  it('declares property globals, handlers and vision meters', () => {
    expect(
      generateTypes({
        title: 'T',
        properties: [
          { property: 'speed', type: 'number', label: 'S', min: 0, max: 1, default: 0 },
          { property: 'baseHue', type: 'hue', label: 'H', default: 0 },
          { property: 'rainbow', type: 'boolean', label: 'R', default: true },
          { property: 'tint', type: 'color', label: 'C', default: '#000000' },
          { property: 'text', type: 'textfield', label: 'T', default: '' },
          { property: 'mode', type: 'list', label: 'M', values: ['Wave', 'It\'s "x"'], default: 'Wave' },
        ],
        meters: [{ meter: 'health', type: 'ocr_numeric', x: 0, y: 0, width: 0.1, height: 0.1 }],
      }),
    ).toBe(`// Generated by srgb-effect-kit. Do not edit.
/// <reference types="srgb-effect-kit/client" />
declare global {
  var speed: number;
  var baseHue: number;
  var rainbow: SRGBBoolean;
  var tint: string;
  var text: string;
  var mode: "Wave" | "It's \\"x\\"";

  var onSpeedChanged: (() => void) | undefined;
  var onBaseHueChanged: (() => void) | undefined;
  var onRainbowChanged: (() => void) | undefined;
  var onTintChanged: (() => void) | undefined;
  var onTextChanged: (() => void) | undefined;
  var onModeChanged: (() => void) | undefined;

  interface SRGBVision {
    health: number;
  }
}
export {};
`);
  });

  it('produces an empty global block for a manifest without properties or meters', () => {
    expect(generateTypes({ title: 'T' })).toBe(`// Generated by srgb-effect-kit. Do not edit.
/// <reference types="srgb-effect-kit/client" />
declare global {
}
export {};
`);
  });
});
```

`packages/srgb-effect-kit/src/shared/prelude.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { generatePrelude } from './prelude';

describe('generatePrelude', () => {
  it('defines missing handler globals so bare assignment works in strict code', () => {
    const prelude = generatePrelude({
      title: 'T',
      properties: [{ property: 'speed', type: 'number', label: 'S', min: 0, max: 1, default: 0 }],
    });
    const win: Record<string, unknown> = { onCanvasApiEvent: 'kept' };
    new Function('window', prelude)(win);
    expect(Object.keys(win).sort()).toEqual(['onCanvasApiEvent', 'onSpeedChanged']);
    expect(win.onSpeedChanged).toBeUndefined();
    expect(win.onCanvasApiEvent).toBe('kept');
  });

  it('is ES5 syntax only', () => {
    const prelude = generatePrelude({ title: 'T' });
    expect(prelude).not.toMatch(/=>|\blet\b|\bconst\b|`/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/shared/typegen.test.ts src/shared/prelude.test.ts`
Expected: FAIL, because the modules are not found.

- [ ] **Step 3: Implement**

`packages/srgb-effect-kit/src/shared/typegen.ts`:
```ts
import { handlerName } from './names';
import type { EffectManifest, PropertyDef } from './types';

const globalType = (p: PropertyDef): string => {
  switch (p.type) {
    case 'number':
    case 'hue':
      return 'number';
    case 'boolean':
      return 'SRGBBoolean';
    case 'color':
    case 'textfield':
      return 'string';
    case 'list':
      return p.values.map((value) => JSON.stringify(value)).join(' | ');
  }
};

/** Contents of the committed `.d.ts` that types SignalRGB's injected globals. */
export function generateTypes(manifest: EffectManifest): string {
  const properties = manifest.properties ?? [];
  const meters = manifest.meters ?? [];
  const lines = [
    '// Generated by srgb-effect-kit. Do not edit.',
    '/// <reference types="srgb-effect-kit/client" />',
    'declare global {',
  ];

  for (const p of properties) lines.push(`  var ${p.property}: ${globalType(p)};`);
  if (properties.length > 0) {
    lines.push('');
    for (const p of properties) lines.push(`  var ${handlerName(p.property)}: (() => void) | undefined;`);
  }
  if (meters.length > 0) {
    if (properties.length > 0) lines.push('');
    lines.push('  interface SRGBVision {', ...meters.map((m) => `    ${m.meter}: number;`), '  }');
  }

  lines.push('}', 'export {};', '');
  return lines.join('\n');
}
```

`packages/srgb-effect-kit/src/shared/prelude.ts`:
```ts
import { handlerName } from './names';
import type { EffectManifest } from './types';

/**
 * ES5 snippet run before effect code. It makes sure every handler global exists on window,
 * so a bare `onSpeedChanged = …` in strict module code does not throw a ReferenceError.
 */
export function generatePrelude(manifest: EffectManifest): string {
  const names = [...(manifest.properties ?? []).map((p) => handlerName(p.property)), 'onCanvasApiEvent'];
  return `(function(){var w=window,n=${JSON.stringify(names)};for(var i=0;i<n.length;i++){if(!(n[i] in w))w[n[i]]=undefined;}})();`;
}
```

`packages/srgb-effect-kit/src/shared/index.ts`:
```ts
export * from './html';
export * from './names';
export * from './prelude';
export * from './serialize';
export * from './typegen';
export type * from './types';
export * from './validate';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter srgb-effect-kit test src/shared && pnpm lint && pnpm --filter srgb-effect-kit typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/shared
git commit -m "feat(shared): generate global typings and handler prelude" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Runtime foundation (types, engine, booleans, renderer, canvas) + client types

**Files:**
- Create: `packages/srgb-effect-kit/src/runtime/types.ts`, `engine.ts`, `boolean.ts`, `renderer.ts`, `canvas.ts`, `index.ts`
- Create: `packages/srgb-effect-kit/client.d.ts`
- Test: `packages/srgb-effect-kit/src/runtime/boolean.test.ts`, `renderer.test.ts`, `canvas.test.ts`, `engine.test.ts`

**Interfaces:**
- Produces:
  - Types: `SRGBBoolean`, `EngineAudio`, `EngineZone`, `Engine`, `CanvasApiEvent`, `Renderer`, `CanvasContextType`, `GetCanvasOptions<C>`, `CanvasHandle<C>`
  - `getEngine(): Partial<Engine> | undefined`
  - `parseBoolean(value: SRGBBoolean | boolean | number | string): boolean`
  - `RENDERER_SIGNATURES`
  - `detectRenderer(userAgent?: string): Renderer`
  - `isSignalRGB(userAgent?: string): boolean`
  - `getCanvas<C extends CanvasContextType = '2d'>(options?: GetCanvasOptions<C>): CanvasHandle<C>`

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/runtime/boolean.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseBoolean } from './boolean';

describe('parseBoolean', () => {
  it.each([
    ['1', true],
    ['0', false],
    [1, true],
    [0, false],
    [true, true],
    [false, false],
    ['true', true],
    ['false', false],
    ['', false],
  ] as const)('%j → %s', (input, expected) => {
    expect(parseBoolean(input)).toBe(expected);
  });
});
```

`packages/srgb-effect-kit/src/runtime/renderer.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { detectRenderer, isSignalRGB } from './renderer';

const ULTRALIGHT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/615.1.18.100.1 (KHTML, like Gecko) Ultralight/1.4.0 Version/16.4.1 Safari/615.1.18.100.1';
const QTWEBENGINE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/6.8.2 Chrome/122.0.6261.171 Safari/537.36';
const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('detectRenderer', () => {
  it('identifies renderers from the user agent', () => {
    expect(detectRenderer(ULTRALIGHT)).toBe('ultralight');
    expect(detectRenderer(QTWEBENGINE)).toBe('qtwebengine');
    expect(detectRenderer(CHROME)).toBe('browser');
    expect(detectRenderer('')).toBe('browser');
  });

  it('isSignalRGB is true for either SignalRGB renderer', () => {
    expect(isSignalRGB(ULTRALIGHT)).toBe(true);
    expect(isSignalRGB(QTWEBENGINE)).toBe(true);
    expect(isSignalRGB(CHROME)).toBe(false);
  });
});
```
These UA strings are **placeholders** until the probe (Plan 3) records the real ones. Plan 3 replaces them.

`packages/srgb-effect-kit/src/runtime/canvas.test.ts`:
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCanvas } from './canvas';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('getCanvas', () => {
  it('returns the first canvas and its 2d context by default', () => {
    document.body.innerHTML = '<canvas id="a"></canvas><canvas id="b"></canvas>';
    const ctx = {} as CanvasRenderingContext2D;
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
    const handle = getCanvas();
    expect(handle.canvas.id).toBe('a');
    expect(handle.ctx).toBe(ctx);
    expect(spy).toHaveBeenCalledWith('2d');
  });

  it('selects by id and context type', () => {
    document.body.innerHTML = '<canvas id="a"></canvas><canvas id="b"></canvas>';
    const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as never);
    expect(getCanvas({ id: 'b', context: 'webgl2' }).canvas.id).toBe('b');
    expect(spy).toHaveBeenCalledWith('webgl2');
  });

  it('throws clear errors', () => {
    expect(() => getCanvas()).toThrow('[srgb-effect] getCanvas: no <canvas> element found');
    document.body.innerHTML = '<div id="x"></div>';
    expect(() => getCanvas({ id: 'x' })).toThrow('[srgb-effect] getCanvas: no <canvas id="x"> element found');
    document.body.innerHTML = '<canvas></canvas>';
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(() => getCanvas({ context: 'webgl' })).toThrow('[srgb-effect] getCanvas: "webgl" context is not available');
  });
});
```

`packages/srgb-effect-kit/src/runtime/engine.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest';
import { getEngine } from './engine';

afterEach(() => {
  delete (globalThis as { engine?: unknown }).engine;
});

describe('getEngine', () => {
  it('returns undefined outside SignalRGB', () => {
    expect(getEngine()).toBeUndefined();
  });

  it('returns the injected engine global', () => {
    const engine = { audio: { level: -50, width: 0, density: 0, freq: [] } };
    (globalThis as { engine?: unknown }).engine = engine;
    expect(getEngine()).toBe(engine);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/runtime`
Expected: FAIL, because the modules are not found.

- [ ] **Step 3: Implement**

`packages/srgb-effect-kit/src/runtime/types.ts`:
```ts
/** Raw boolean property value. Provisional until the probe confirms the real shape. */
export type SRGBBoolean = '0' | '1';

export interface EngineAudio {
  /** Loudness in dB, -100 (silent) to 0 (loud). */
  level: number;
  /** Stereo width, 0–1. */
  width: number;
  /** 0 (pure tone) to 1 (white noise). */
  density: number;
  /** 200 frequency bands. Values can be negative or garbage; prefer getFrequencies(). */
  freq: ArrayLike<number>;
}

/** 28×20 screen grid, 560 entries per channel. */
export interface EngineZone {
  hue: ArrayLike<number>;
  saturation: ArrayLike<number>;
  lightness: ArrayLike<number>;
}

export interface Engine {
  audio: EngineAudio;
  zone: EngineZone;
  /** Screen meter values keyed by meter name. */
  vision: Record<string, number>;
}

export interface CanvasApiEvent {
  sender: string;
  event: string;
}
```

`packages/srgb-effect-kit/src/runtime/engine.ts`:
```ts
import type { Engine } from './types';

/** The `engine` global SignalRGB injects, or undefined outside SignalRGB (and before devtools mocks it). */
export const getEngine = (): Partial<Engine> | undefined =>
  (globalThis as { engine?: Partial<Engine> }).engine;
```

`packages/srgb-effect-kit/src/runtime/boolean.ts`:
```ts
import type { SRGBBoolean } from './types';

/** Normalizes a SignalRGB boolean property, tolerating every plausible raw form. */
export const parseBoolean = (value: SRGBBoolean | boolean | number | string): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
};
```

`packages/srgb-effect-kit/src/runtime/renderer.ts`:
```ts
export type Renderer = 'ultralight' | 'qtwebengine' | 'browser';

/** User-agent signatures per SignalRGB renderer. Confirmed by the probe effect. */
export const RENDERER_SIGNATURES: readonly (readonly [Exclude<Renderer, 'browser'>, RegExp])[] = [
  ['ultralight', /\bUltralight\//i],
  ['qtwebengine', /\bQtWebEngine\//i],
];

export const detectRenderer = (userAgent: string = globalThis.navigator?.userAgent ?? ''): Renderer =>
  RENDERER_SIGNATURES.find(([, signature]) => signature.test(userAgent))?.[0] ?? 'browser';

export const isSignalRGB = (userAgent?: string): boolean => detectRenderer(userAgent) !== 'browser';
```

`packages/srgb-effect-kit/src/runtime/canvas.ts`:
```ts
export type CanvasContextType = '2d' | 'webgl' | 'webgl2';

type ContextFor<C extends CanvasContextType> = C extends '2d'
  ? CanvasRenderingContext2D
  : C extends 'webgl'
    ? WebGLRenderingContext
    : WebGL2RenderingContext;

export interface GetCanvasOptions<C extends CanvasContextType> {
  /** Canvas element id. Defaults to the first <canvas> in the document. */
  id?: string;
  /** @default '2d' */
  context?: C;
}

export interface CanvasHandle<C extends CanvasContextType> {
  canvas: HTMLCanvasElement;
  ctx: ContextFor<C>;
}

export function getCanvas<C extends CanvasContextType = '2d'>(
  options: GetCanvasOptions<C> = {},
): CanvasHandle<C> {
  const { id } = options;
  const contextType = options.context ?? '2d';
  const element = id === undefined ? document.querySelector('canvas') : document.getElementById(id);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(`[srgb-effect] getCanvas: no ${id === undefined ? '<canvas>' : `<canvas id="${id}">`} element found`);
  }
  const ctx = element.getContext(contextType);
  if (!ctx) throw new Error(`[srgb-effect] getCanvas: "${contextType}" context is not available`);
  return { canvas: element, ctx: ctx as ContextFor<C> };
}
```

`packages/srgb-effect-kit/src/runtime/index.ts`:
```ts
export { parseBoolean } from './boolean';
export { getCanvas } from './canvas';
export type { CanvasContextType, CanvasHandle, GetCanvasOptions } from './canvas';
export { getEngine } from './engine';
export { RENDERER_SIGNATURES, detectRenderer, isSignalRGB } from './renderer';
export type { Renderer } from './renderer';
export type { CanvasApiEvent, Engine, EngineAudio, EngineZone, SRGBBoolean } from './types';
```

`packages/srgb-effect-kit/client.d.ts`:
```ts
// Ambient SignalRGB globals. Referenced by the generated src/srgb-effect.d.ts in effect projects.
import type { CanvasApiEvent, Engine, SRGBBoolean as RuntimeSRGBBoolean } from './dist/runtime/index.js';

declare global {
  type SRGBBoolean = RuntimeSRGBBoolean;

  /** Screen meter values. Augmented with one key per meter by the generated types file. */
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- augmented via declaration merging
  interface SRGBVision {}

  var engine: Omit<Engine, 'vision'> & { vision: SRGBVision };
  var onCanvasApiEvent: ((event: CanvasApiEvent) => void) | undefined;
}

export {};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter srgb-effect-kit test src/runtime && pnpm lint && pnpm --filter srgb-effect-kit typecheck`
Expected: PASS.

`client.d.ts` is not in the package tsconfig `include`, because it depends on `dist/`. It gets verified in Task 13 through the examples.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/runtime packages/srgb-effect-kit/client.d.ts
git commit -m "feat(runtime): add engine types, renderer detection and canvas helper" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Color utilities

**Files:**
- Create: `packages/srgb-effect-kit/src/runtime/color.ts`
- Modify: `packages/srgb-effect-kit/src/runtime/index.ts`
- Test: `packages/srgb-effect-kit/src/runtime/color.test.ts`

**Interfaces:**
- Produces:
  - Types: `Rgb { r: number; g: number; b: number }` (0–255) and `Hsl { h: number; s: number; l: number }` (h 0–360, s and l 0–100)
  - `hexToRgb(hex: string): Rgb`
  - `rgbToHex(rgb: Rgb): string`
  - `rgbToHsl(rgb: Rgb): Hsl`
  - `hslToRgb(hsl: Hsl): Rgb`
  - `hexToHsl(hex: string): Hsl`
  - `hslToHex(hsl: Hsl): string`
  - `hsl(h: number, s: number, l: number, a?: number): string`
  - `rgb(r: number, g: number, b: number, a?: number): string`
  - `lerpColor(from: string, to: string, t: number): string`

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/runtime/color.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hexToHsl, hexToRgb, hsl, hslToHex, hslToRgb, lerpColor, rgb, rgbToHex, rgbToHsl } from './color';

describe('hex <-> rgb', () => {
  it('parses 6- and 3-digit hex in any case', () => {
    expect(hexToRgb('#009bde')).toEqual({ r: 0, g: 155, b: 222 });
    expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb('00ff00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('throws on invalid hex', () => {
    expect(() => hexToRgb('red')).toThrow('[srgb-effect] invalid hex color "red"');
  });

  it('formats lowercase hex, rounding and clamping', () => {
    expect(rgbToHex({ r: 0, g: 155, b: 222 })).toBe('#009bde');
    expect(rgbToHex({ r: 300, g: -5, b: 127.6 })).toBe('#ff0080');
  });
});

describe('rgb <-> hsl', () => {
  it('converts primaries and greys', () => {
    expect(rgbToHsl({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 100, l: 50 });
    expect(rgbToHsl({ r: 0, g: 0, b: 255 })).toEqual({ h: 240, s: 100, l: 50 });
    expect(rgbToHsl({ r: 128, g: 128, b: 128 })).toEqual({ h: 0, s: 0, l: 50.2 });
    expect(hslToRgb({ h: 120, s: 100, l: 50 })).toEqual({ r: 0, g: 255, b: 0 });
    expect(hslToRgb({ h: 0, s: 0, l: 100 })).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('wraps hue and round-trips through hex', () => {
    expect(hslToRgb({ h: 480, s: 100, l: 50 })).toEqual(hslToRgb({ h: 120, s: 100, l: 50 }));
    expect(hslToRgb({ h: -120, s: 100, l: 50 })).toEqual(hslToRgb({ h: 240, s: 100, l: 50 }));
    expect(hslToHex(hexToHsl('#009bde'))).toBe('#009bde');
  });
});

describe('css string builders', () => {
  it('uses comma syntax for older engines', () => {
    expect(hsl(200, 100, 50)).toBe('hsl(200, 100%, 50%)');
    expect(hsl(200, 100, 50, 0.5)).toBe('hsla(200, 100%, 50%, 0.5)');
    expect(rgb(1, 2, 3)).toBe('rgb(1, 2, 3)');
    expect(rgb(1, 2, 3, 0)).toBe('rgba(1, 2, 3, 0)');
  });
});

describe('lerpColor', () => {
  it('interpolates in rgb and clamps t', () => {
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(lerpColor('#ff0000', '#0000ff', 0)).toBe('#ff0000');
    expect(lerpColor('#ff0000', '#0000ff', 2)).toBe('#0000ff');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/runtime/color.test.ts`
Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement**

`packages/srgb-effect-kit/src/runtime/color.ts`:
```ts
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  /** 0–360 */
  h: number;
  /** 0–100 */
  s: number;
  /** 0–100 */
  l: number;
}

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round1 = (value: number) => Math.round(value * 10) / 10;

export function hexToRgb(hex: string): Rgb {
  const match = HEX.exec(hex);
  if (!match) throw new Error(`[srgb-effect] invalid hex color "${hex}"`);
  let digits = match[1]!;
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
  const value = Number.parseInt(digits, 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export const rgbToHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((c) => Math.round(clamp(c, 0, 255)).toString(16).padStart(2, '0')).join('')}`;

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: round1(l * 100) };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / delta) % 6;
  else if (max === gn) h = (bn - rn) / delta + 2;
  else h = (rn - gn) / delta + 4;
  h = (h * 60 + 360) % 360;
  return { h: round1(h), s: round1(s * 100), l: round1(l * 100) };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hue = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = ln - chroma / 2;
  const [r1, g1, b1] =
    hue < 60 ? [chroma, x, 0]
    : hue < 120 ? [x, chroma, 0]
    : hue < 180 ? [0, chroma, x]
    : hue < 240 ? [0, x, chroma]
    : hue < 300 ? [x, 0, chroma]
    : [chroma, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export const hexToHsl = (hex: string): Hsl => rgbToHsl(hexToRgb(hex));
export const hslToHex = (value: Hsl): string => rgbToHex(hslToRgb(value));

export const hsl = (h: number, s: number, l: number, a?: number): string =>
  a === undefined ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${a})`;

export const rgb = (r: number, g: number, b: number, a?: number): string =>
  a === undefined ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`;

export function lerpColor(from: string, to: string, t: number): string {
  const amount = clamp(t, 0, 1);
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return rgbToHex({
    r: a.r + (b.r - a.r) * amount,
    g: a.g + (b.g - a.g) * amount,
    b: a.b + (b.b - a.b) * amount,
  });
}
```

Append to `packages/srgb-effect-kit/src/runtime/index.ts`:
```ts
export { hexToHsl, hexToRgb, hsl, hslToHex, hslToRgb, lerpColor, rgb, rgbToHex, rgbToHsl } from './color';
export type { Hsl, Rgb } from './color';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter srgb-effect-kit test src/runtime/color.test.ts && pnpm lint`
Expected: PASS.

The grey case expects `l: 50.2` because 128/255 = 0.50196, which rounds to one decimal as 50.2. Adjust the expectation only if the formula is proven correct and the rounding differs.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/runtime
git commit -m "feat(runtime): add color utilities" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Render loop

**Files:**
- Create: `packages/srgb-effect-kit/src/runtime/loop.ts`
- Modify: `packages/srgb-effect-kit/src/runtime/index.ts`
- Test: `packages/srgb-effect-kit/src/runtime/loop.test.ts`

**Interfaces:**
- Produces:
  - Types: `LoopInfo { dt: number; time: number; frameCount: number }`, `LoopOptions { maxFps?: number }`, `Loop { start(): void; stop(): void; setMaxFps(maxFps: number | undefined): void; readonly running: boolean }`
  - `createLoop(frame: (info: LoopInfo) => void, options?: LoopOptions): Loop`
- Semantics:
  - `dt` is the time in seconds since the previous **rendered** frame, and `0` on the first frame.
  - `time` is the time in seconds since the first rendered frame.
  - `frameCount` is 1-based and counts rendered frames.

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/runtime/loop.test.ts`:
```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoop, type LoopInfo } from './loop';

let queue: Map<number, FrameRequestCallback>;
let nextId: number;

/** Runs every pending rAF callback with the given timestamp (one display refresh). */
const tick = (timestamp: number) => {
  const callbacks = [...queue.values()];
  queue.clear();
  for (const callback of callbacks) callback(timestamp);
};

beforeEach(() => {
  queue = new Map();
  nextId = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queue.delete(id));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createLoop', () => {
  it('calls frame on every refresh with dt, time and frameCount', () => {
    const infos: LoopInfo[] = [];
    const loop = createLoop((info) => infos.push(info));
    loop.start();
    tick(1000);
    tick(1016);
    tick(1050);
    expect(infos).toEqual([
      { dt: 0, time: 0, frameCount: 1 },
      { dt: 0.016, time: 0.016, frameCount: 2 },
      { dt: 0.034, time: 0.05, frameCount: 3 },
    ]);
  });

  it('caps the frame rate by skipping refreshes', () => {
    const frame = vi.fn();
    const loop = createLoop(frame, { maxFps: 30 });
    loop.start();
    for (let i = 0; i <= 60; i += 1) tick(1000 + i * (1000 / 60));
    // 61 refreshes over one second at 60 Hz render 31 frames at a 30 fps cap (both ends included).
    expect(frame).toHaveBeenCalledTimes(31);
  });

  it('tolerates refresh jitter below the cap interval', () => {
    const frame = vi.fn();
    const loop = createLoop(frame, { maxFps: 30 });
    loop.start();
    tick(0);
    tick(33); // 0.33ms short of 33.33ms, but within tolerance
    expect(frame).toHaveBeenCalledTimes(2);
  });

  it('stops and restarts', () => {
    const frame = vi.fn();
    const loop = createLoop(frame);
    loop.start();
    loop.start(); // idempotent
    tick(0);
    expect(loop.running).toBe(true);
    loop.stop();
    expect(loop.running).toBe(false);
    tick(16);
    expect(frame).toHaveBeenCalledTimes(1);
    loop.start();
    tick(32);
    tick(48);
    expect(frame).toHaveBeenCalledTimes(3);
    expect(frame.mock.calls[1]![0]).toMatchObject({ dt: 0, frameCount: 2 });
  });

  it('changes the cap while running', () => {
    const frame = vi.fn();
    const loop = createLoop(frame, { maxFps: 10 });
    loop.start();
    tick(0);
    tick(50);
    expect(frame).toHaveBeenCalledTimes(1);
    loop.setMaxFps(undefined);
    tick(66);
    expect(frame).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/runtime/loop.test.ts`
Expected: FAIL, because the module is not found.

- [ ] **Step 3: Implement**

`packages/srgb-effect-kit/src/runtime/loop.ts`:
```ts
export interface LoopInfo {
  /** Seconds since the previous rendered frame (0 on the first frame after start). */
  dt: number;
  /** Seconds since the first rendered frame. */
  time: number;
  /** 1-based count of rendered frames. */
  frameCount: number;
}

export interface LoopOptions {
  /** Upper bound on rendered frames per second. Unset renders on every refresh. */
  maxFps?: number;
}

export interface Loop {
  start(): void;
  stop(): void;
  setMaxFps(maxFps: number | undefined): void;
  readonly running: boolean;
}

/** Refreshes this many ms early still count, to absorb rAF timestamp jitter. */
const JITTER_TOLERANCE_MS = 1;

/** Rounds to microseconds so float noise doesn't leak into dt/time. */
const round = (seconds: number) => Math.round(seconds * 1e6) / 1e6;

export function createLoop(frame: (info: LoopInfo) => void, options: LoopOptions = {}): Loop {
  let maxFps = options.maxFps;
  let running = false;
  let rafId = 0;
  let frameCount = 0;
  let firstTimestamp: number | undefined;
  let previousFrame: number | undefined; // previous rendered frame, for dt
  let anchor: number | undefined; // cadence anchor for the fps cap

  const tick = (timestamp: number) => {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    if (maxFps !== undefined && anchor !== undefined) {
      const interval = 1000 / maxFps;
      const elapsed = timestamp - anchor;
      if (elapsed < interval - JITTER_TOLERANCE_MS) return;
      // Advance the anchor by whole intervals so the cadence doesn't drift with each refresh.
      const remainder = elapsed % interval;
      anchor = remainder > interval - JITTER_TOLERANCE_MS ? timestamp : timestamp - remainder;
    } else {
      anchor = timestamp;
    }

    firstTimestamp ??= timestamp;
    const dt = previousFrame === undefined ? 0 : (timestamp - previousFrame) / 1000;
    previousFrame = timestamp;
    frameCount += 1;
    frame({ dt: round(dt), time: round((timestamp - firstTimestamp) / 1000), frameCount });
  };

  return {
    start() {
      if (running) return;
      running = true;
      previousFrame = undefined;
      anchor = undefined;
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
    setMaxFps(value) {
      maxFps = value;
    },
    get running() {
      return running;
    },
  };
}
```

Append to `packages/srgb-effect-kit/src/runtime/index.ts`:
```ts
export { createLoop } from './loop';
export type { Loop, LoopInfo, LoopOptions } from './loop';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter srgb-effect-kit test src/runtime/loop.test.ts && pnpm lint && pnpm --filter srgb-effect-kit typecheck`
Expected: PASS.

In the cap test, the anchor advances by exactly 33.33ms per rendered frame, so refreshes 0, 2, 4, … 60 render, which is 31 frames. In the restart test, `start()` resets `previousFrame`, which makes the second rendered frame's `dt` equal 0.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/runtime
git commit -m "feat(runtime): add fps-capped render loop" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Audio, screen zones and meter helpers

**Files:**
- Create: `packages/srgb-effect-kit/src/runtime/audio.ts`, `zones.ts`, `meter.ts`
- Modify: `packages/srgb-effect-kit/src/runtime/index.ts`
- Test: `packages/srgb-effect-kit/src/runtime/audio.test.ts`, `zones.test.ts`, `meter.test.ts`

**Interfaces:**
- Consumes:
  - `getEngine()`, `EngineAudio`, `EngineZone` (Task 6)
- Produces:
  - Constants: `FREQUENCY_BINS = 200`, `SILENCE_SUM_THRESHOLD = 50`, `ZONE_COLUMNS = 28`, `ZONE_ROWS = 20`
  - `isSilent(audio?: Partial<EngineAudio>): boolean`
  - `getFrequencies(audio?: Partial<EngineAudio>): number[]`
  - `ZoneColor { h: number; s: number; l: number }`
  - `getZone(x: number, y: number, zone?: Partial<EngineZone>): ZoneColor`
  - `getZones(zone?: Partial<EngineZone>): ZoneColor[]`
  - `Meter { readonly value; readonly diff; readonly increased; readonly decreased; setValue(v: number): void }`
  - `createMeter(size: number, callback: (meter: Meter) => void): Meter`

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/runtime/audio.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest';
import { FREQUENCY_BINS, getFrequencies, isSilent } from './audio';

const freq = (fill: number) => Array.from({ length: FREQUENCY_BINS }, () => fill);
afterEach(() => {
  delete (globalThis as { engine?: unknown }).engine;
});

describe('isSilent', () => {
  it('is silent without an engine', () => {
    expect(isSilent()).toBe(true);
  });

  it('is silent at -100 dB or when the spectrum sum is below the threshold', () => {
    expect(isSilent({ level: -100, freq: freq(200) })).toBe(true);
    expect(isSilent({ level: -40, freq: [1, 1, 2, 4, 6, 19] })).toBe(true);
    expect(isSilent({ level: -40, freq: [] })).toBe(true);
  });

  it('ignores negative garbage values in the sum', () => {
    expect(isSilent({ level: -40, freq: [-2147483648, 10, 10] })).toBe(true);
  });

  it('is not silent with real signal', () => {
    expect(isSilent({ level: -20, freq: freq(1) })).toBe(false);
  });

  it('reads the engine global by default', () => {
    (globalThis as { engine?: unknown }).engine = { audio: { level: -20, freq: freq(5) } };
    expect(isSilent()).toBe(false);
  });
});

describe('getFrequencies', () => {
  it('returns 200 zeros without an engine', () => {
    expect(getFrequencies()).toEqual(freq(0));
  });

  it('sanitizes negatives, non-finite values and overflow, and pads to 200', () => {
    const result = getFrequencies({ freq: [10, -5, Number.NaN, 300, Infinity, 255.4] });
    expect(result.slice(0, 6)).toEqual([10, 0, 0, 255, 0, 255.4]);
    expect(result).toHaveLength(FREQUENCY_BINS);
  });
});
```

`packages/srgb-effect-kit/src/runtime/zones.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest';
import { ZONE_COLUMNS, ZONE_ROWS, getZone, getZones } from './zones';

const grid = (fn: (i: number) => number) => Array.from({ length: ZONE_COLUMNS * ZONE_ROWS }, (_, i) => fn(i));
const zone = { hue: grid((i) => i % 360), saturation: grid(() => 50), lightness: grid((i) => i % 101) };

afterEach(() => {
  delete (globalThis as { engine?: unknown }).engine;
});

describe('getZone', () => {
  it('reads the row-major 28×20 grid', () => {
    expect(getZone(0, 0, zone)).toEqual({ h: 0, s: 50, l: 0 });
    expect(getZone(27, 0, zone)).toEqual({ h: 27, s: 50, l: 27 });
    expect(getZone(1, 1, zone)).toEqual({ h: 29, s: 50, l: 29 });
  });

  it('throws on out-of-range coordinates', () => {
    expect(() => getZone(28, 0, zone)).toThrow(RangeError);
    expect(() => getZone(0, 20, zone)).toThrow(RangeError);
    expect(() => getZone(-1, 0, zone)).toThrow(RangeError);
    expect(() => getZone(1.5, 0, zone)).toThrow(RangeError);
  });

  it('returns black when no zone data exists', () => {
    expect(getZone(3, 3)).toEqual({ h: 0, s: 0, l: 0 });
  });

  it('reads the engine global by default', () => {
    (globalThis as { engine?: unknown }).engine = { zone };
    expect(getZone(2, 0)).toEqual({ h: 2, s: 50, l: 2 });
  });
});

describe('getZones', () => {
  it('returns all 560 zones in row-major order', () => {
    const zones = getZones(zone);
    expect(zones).toHaveLength(560);
    expect(zones[29]).toEqual({ h: 29, s: 50, l: 29 });
  });
});
```

`packages/srgb-effect-kit/src/runtime/meter.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { createMeter } from './meter';

describe('createMeter', () => {
  it('fires only after `size` identical values that differ from the current value', () => {
    const callback = vi.fn();
    const meter = createMeter(3, callback);
    meter.setValue(1);
    meter.setValue(1);
    expect(callback).not.toHaveBeenCalled();
    meter.setValue(1);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(meter).toMatchObject({ value: 1, diff: 1, increased: true, decreased: false });
    meter.setValue(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('ignores unstable readings', () => {
    const callback = vi.fn();
    const meter = createMeter(2, callback);
    for (const v of [0.5, 0.6, 0.5, 0.6]) meter.setValue(v);
    expect(callback).not.toHaveBeenCalled();
  });

  it('reports decreases and passes itself to the callback', () => {
    const seen: number[] = [];
    const meter = createMeter(1, (m) => seen.push(m.value));
    meter.setValue(0.8);
    meter.setValue(0.3);
    expect(seen).toEqual([0.8, 0.3]);
    expect(meter).toMatchObject({ value: 0.3, increased: false, decreased: true });
    expect(meter.diff).toBeCloseTo(0.5);
  });

  it('rejects sizes below 1', () => {
    expect(() => createMeter(0, () => {})).toThrow('[srgb-effect] createMeter: size must be a positive integer');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/runtime/audio.test.ts src/runtime/zones.test.ts src/runtime/meter.test.ts`
Expected: FAIL, because the modules are not found.

- [ ] **Step 3: Implement**

`packages/srgb-effect-kit/src/runtime/audio.ts`:
```ts
import { getEngine } from './engine';
import type { EngineAudio } from './types';

export const FREQUENCY_BINS = 200;
/**
 * SignalRGB leaks a low noise floor into `freq` while nothing is playing, so a spectrum whose
 * positive values sum to less than this counts as silence.
 */
export const SILENCE_SUM_THRESHOLD = 50;

export function isSilent(audio: Partial<EngineAudio> | undefined = getEngine()?.audio): boolean {
  if (!audio) return true;
  if (audio.level !== undefined && audio.level <= -100) return true;
  const { freq } = audio;
  if (!freq || freq.length === 0) return true;

  let sum = 0;
  for (let i = 0; i < freq.length; i += 1) {
    const value = freq[i]!;
    if (value > 0) sum += value;
    if (sum >= SILENCE_SUM_THRESHOLD) return false;
  }
  return true;
}

/** 200 sanitized bands: non-finite or negative values become 0 and the rest clamp to 255. Range is provisional until probed. */
export function getFrequencies(audio: Partial<EngineAudio> | undefined = getEngine()?.audio): number[] {
  const freq = audio?.freq;
  const out = new Array<number>(FREQUENCY_BINS).fill(0);
  if (!freq) return out;
  for (let i = 0; i < Math.min(FREQUENCY_BINS, freq.length); i += 1) {
    const value = freq[i]!;
    out[i] = Number.isFinite(value) && value > 0 ? Math.min(255, value) : 0;
  }
  return out;
}
```

`packages/srgb-effect-kit/src/runtime/zones.ts`:
```ts
import { getEngine } from './engine';
import type { EngineZone } from './types';

export const ZONE_COLUMNS = 28;
export const ZONE_ROWS = 20;

export interface ZoneColor {
  h: number;
  s: number;
  l: number;
}

const read = (zone: Partial<EngineZone> | undefined, index: number): ZoneColor => ({
  h: zone?.hue?.[index] ?? 0,
  s: zone?.saturation?.[index] ?? 0,
  l: zone?.lightness?.[index] ?? 0,
});

/** Screen color of one cell in SignalRGB's 28×20 grid (row-major, origin top-left). */
export function getZone(x: number, y: number, zone: Partial<EngineZone> | undefined = getEngine()?.zone): ZoneColor {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= ZONE_COLUMNS || y < 0 || y >= ZONE_ROWS) {
    throw new RangeError(`[srgb-effect] getZone: (${x}, ${y}) is outside the ${ZONE_COLUMNS}×${ZONE_ROWS} grid`);
  }
  return read(zone, y * ZONE_COLUMNS + x);
}

export function getZones(zone: Partial<EngineZone> | undefined = getEngine()?.zone): ZoneColor[] {
  return Array.from({ length: ZONE_COLUMNS * ZONE_ROWS }, (_, index) => read(zone, index));
}
```

`packages/srgb-effect-kit/src/runtime/meter.ts`:
```ts
export interface Meter {
  readonly value: number;
  /** Absolute change of the last accepted update. */
  readonly diff: number;
  readonly increased: boolean;
  readonly decreased: boolean;
  /** Feed one reading per frame, e.g. `meter.setValue(engine.vision.health)`. */
  setValue(value: number): void;
}

/**
 * Debounced screen-meter reader (typed port of the Meter class from SignalRGB's docs).
 * The callback fires only after `size` identical consecutive readings that differ from the current value.
 */
export function createMeter(size: number, callback: (meter: Meter) => void): Meter {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('[srgb-effect] createMeter: size must be a positive integer');
  }
  const readings: number[] = [];
  const state = { value: 0, diff: 0, increased: false, decreased: false };

  const meter: Meter = {
    get value() {
      return state.value;
    },
    get diff() {
      return state.diff;
    },
    get increased() {
      return state.increased;
    },
    get decreased() {
      return state.decreased;
    },
    setValue(reading) {
      readings.push(reading);
      if (readings.length > size) readings.shift();
      if (readings.length < size || readings.some((r) => r !== readings[0])) return;
      const stable = readings[0]!;
      if (stable === state.value) return;
      state.diff = Math.abs(stable - state.value);
      state.increased = stable > state.value;
      state.decreased = stable < state.value;
      state.value = stable;
      callback(meter);
    },
  };
  return meter;
}
```

Append to `packages/srgb-effect-kit/src/runtime/index.ts`:
```ts
export { FREQUENCY_BINS, SILENCE_SUM_THRESHOLD, getFrequencies, isSilent } from './audio';
export { createMeter } from './meter';
export type { Meter } from './meter';
export { ZONE_COLUMNS, ZONE_ROWS, getZone, getZones } from './zones';
export type { ZoneColor } from './zones';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter srgb-effect-kit test src/runtime && pnpm lint && pnpm --filter srgb-effect-kit typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/runtime
git commit -m "feat(runtime): add audio, screen zone and meter helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Vite plugin core (options, validation, typegen file, serve head injection)

**Files:**
- Create: `packages/srgb-effect-kit/src/vite/options.ts`, `fs.ts`, `corePlugin.ts`, `index.ts`
- Create: `packages/srgb-effect-kit/test/helpers/fixture.ts`
- Test: `packages/srgb-effect-kit/src/vite/options.test.ts`, `packages/srgb-effect-kit/src/vite/fs.test.ts`, `packages/srgb-effect-kit/test/corePlugin.test.ts`, `packages/srgb-effect-kit/src/vite/index.test-d.ts`

**Interfaces:**
- Consumes:
  - From `../shared`: `EffectManifest`, `PropertyDef`, `assertValidManifest`, `generateTypes`, `serializeHead`, `injectIntoHead`, `findForbiddenHeadTags`, `kebabCase`
- Produces:
  - `DevtoolsOptions { fireChangedOnLoad?: boolean }`
  - `SrgbEffectOptions extends EffectManifest { typesFile?; fileName?; script?: 'classic' | 'module'; dropConsole?; target?: string | string[]; devtools?: boolean | DevtoolsOptions }`
  - `ResolvedOptions { manifest: EffectManifest; typesFile: string; fileName: string; script: 'classic' | 'module'; dropConsole: boolean; target: string | string[]; devtools: false | Required<DevtoolsOptions> }`
  - `resolveOptions(options: SrgbEffectOptions): ResolvedOptions`
  - `writeFileIfChanged(file: string, content: string): boolean`
  - `corePlugin(options: ResolvedOptions): Plugin`
  - `srgbEffect(options): Plugin[]`. Its list-default type check comes through the `CheckedProperties<P>` generic.
  - Test helpers:
    - `createFixture(files: Record<string, string | Uint8Array>): string`
    - `buildFixture(root: string, config?: InlineConfig): Promise<{ files: Map<string, string>; warnings: string[] }>`
    - `cleanupFixtures(): void`

- [ ] **Step 1: Write the test helper**

`packages/srgb-effect-kit/test/helpers/fixture.ts`:
```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, createLogger, type InlineConfig, type Rolldown } from 'vite';

const roots: string[] = [];

/** Writes files into a fresh temp directory and returns its path. */
export function createFixture(files: Record<string, string | Uint8Array>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'srgb-effect-'));
  roots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return root;
}

export function cleanupFixtures(): void {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
}

export interface FixtureBuild {
  /** Output file name → text content. */
  files: Map<string, string>;
  warnings: string[];
}

/** Runs `vite build` in memory (write: false) and collects outputs and warnings. */
export async function buildFixture(root: string, config: InlineConfig = {}): Promise<FixtureBuild> {
  const warnings: string[] = [];
  const logger = createLogger('warn', { allowClearScreen: false });
  logger.warn = (message) => void warnings.push(message);
  logger.warnOnce = (message) => void warnings.push(message);

  const result = await build({
    root,
    configFile: false,
    logLevel: 'warn',
    customLogger: logger,
    ...config,
    build: { write: false, ...config.build },
  });

  const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[];
  const files = new Map<string, string>();
  for (const output of outputs) {
    for (const file of output.output) {
      const text =
        file.type === 'chunk'
          ? file.code
          : typeof file.source === 'string'
            ? file.source
            : new TextDecoder().decode(file.source);
      files.set(file.fileName, text);
    }
  }
  return { files, warnings };
}
```

- [ ] **Step 2: Write the failing tests**

`packages/srgb-effect-kit/src/vite/options.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { resolveOptions } from './options';

describe('resolveOptions', () => {
  it('applies defaults and splits manifest from plugin options', () => {
    expect(resolveOptions({ title: 'Hue Cycle', publisher: 'me' })).toEqual({
      manifest: { title: 'Hue Cycle', publisher: 'me' },
      typesFile: 'src/srgb-effect.d.ts',
      fileName: 'hue-cycle.html',
      script: 'classic',
      dropConsole: true,
      target: 'es2020',
      devtools: { fireChangedOnLoad: true },
    });
  });

  it('respects overrides', () => {
    const resolved = resolveOptions({
      title: 'X',
      typesFile: 'types/effect.d.ts',
      fileName: 'custom.html',
      script: 'module',
      dropConsole: false,
      target: ['chrome100', 'safari15'],
      devtools: { fireChangedOnLoad: false },
    });
    expect(resolved).toMatchObject({
      typesFile: 'types/effect.d.ts',
      fileName: 'custom.html',
      script: 'module',
      dropConsole: false,
      target: ['chrome100', 'safari15'],
      devtools: { fireChangedOnLoad: false },
    });
    expect(resolveOptions({ title: 'X', devtools: false }).devtools).toBe(false);
    expect(resolveOptions({ title: 'X', devtools: {} }).devtools).toEqual({ fireChangedOnLoad: true });
  });

  it('rejects file names that are not plain .html files', () => {
    expect(() => resolveOptions({ title: 'X', fileName: 'out/x.html' })).toThrow(/fileName must be a plain file name/);
    expect(() => resolveOptions({ title: 'X', fileName: 'x.htm' })).toThrow(/fileName must be a plain file name/);
  });
});
```

`packages/srgb-effect-kit/src/vite/fs.test.ts`:
```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeFileIfChanged } from './fs';

describe('writeFileIfChanged', () => {
  it('creates directories, writes once and skips identical content', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srgb-fs-'));
    const file = path.join(dir, 'nested', 'a.d.ts');
    expect(writeFileIfChanged(file, 'one')).toBe(true);
    const { mtimeMs } = fs.statSync(file);
    expect(writeFileIfChanged(file, 'one')).toBe(false);
    expect(fs.statSync(file).mtimeMs).toBe(mtimeMs);
    expect(writeFileIfChanged(file, 'two')).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('two');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
```

`packages/srgb-effect-kit/test/corePlugin.test.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { srgbEffect } from '../src/vite';
import { buildFixture, cleanupFixtures, createFixture } from './helpers/fixture';

afterEach(cleanupFixtures);

const options = {
  title: 'Core Test',
  properties: [{ property: 'speed', type: 'number', label: 'Speed', min: 0, max: 10, default: 5 }],
} as const;

describe('srgbEffect core', () => {
  it('validates the manifest when the plugin is created', () => {
    expect(() => srgbEffect({ title: '' })).toThrow(/\[srgb-effect\] Invalid effect manifest/);
  });

  it('writes the generated types file on config resolution', async () => {
    const root = createFixture({ 'index.html': '<body></body>' });
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      plugins: [srgbEffect(options)],
    });
    const typesFile = path.join(root, 'src/srgb-effect.d.ts');
    expect(fs.readFileSync(typesFile, 'utf8')).toContain('var speed: number;');
    await server.close();
  });

  it('injects head markup into index.html while serving', async () => {
    const root = createFixture({ 'index.html': '<!doctype html><html><head></head><body></body></html>' });
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      plugins: [srgbEffect(options)],
    });
    const html = await server.transformIndexHtml('/index.html', fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
    expect(html).toContain('<title>Core Test</title>');
    expect(html).toContain('<meta property="speed" label="Speed" type="number" min="0" max="10" default="5" />');
    await server.close();
  });

  it('fails the build when index.html hand-writes generated tags', async () => {
    const root = createFixture({
      'index.html': '<head><title>Manual</title></head><body><script type="module" src="/main.js"></script></body>',
      'main.js': 'document.body.dataset.x = "1";',
    });
    await expect(buildFixture(root, { plugins: [srgbEffect(options)] })).rejects.toThrow(
      /index\.html must not contain <title>/,
    );
  });
});
```

`packages/srgb-effect-kit/src/vite/index.test-d.ts`:
```ts
import { srgbEffect } from './index';

srgbEffect({ title: 'X', properties: [{ property: 'mode', type: 'list', label: 'Mode', values: ['A', 'B'], default: 'A' }] });

srgbEffect({
  title: 'X',
  properties: [
    { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 1, default: 0 },
    // @ts-expect-error default must be one of values
    { property: 'mode', type: 'list', label: 'Mode', values: ['A', 'B'], default: 'C' },
  ],
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/vite test/corePlugin.test.ts`
Expected: FAIL, because the modules are not found.

- [ ] **Step 4: Implement**

`packages/srgb-effect-kit/src/vite/options.ts`:
```ts
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
    throw new Error(`[srgb-effect] fileName must be a plain file name ending in .html (got "${resolvedFileName}")`);
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
        : { fireChangedOnLoad: (devtools === true ? undefined : devtools.fireChangedOnLoad) ?? true },
  };
}
```

`packages/srgb-effect-kit/src/vite/fs.ts`:
```ts
import fs from 'node:fs';
import path from 'node:path';

/** Writes only when content differs, so watchers don't loop on unchanged output. Returns whether it wrote. */
export function writeFileIfChanged(file: string, content: string): boolean {
  try {
    if (fs.readFileSync(file, 'utf8') === content) return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}
```

`packages/srgb-effect-kit/src/vite/corePlugin.ts`:
```ts
import path from 'node:path';
import type { Plugin } from 'vite';
import { findForbiddenHeadTags, generateTypes, injectIntoHead, serializeHead } from '../shared';
import { writeFileIfChanged } from './fs';
import type { ResolvedOptions } from './options';

export function corePlugin(options: ResolvedOptions): Plugin {
  let command: 'serve' | 'build' = 'serve';

  return {
    name: 'srgb-effect:core',
    configResolved(config) {
      command = config.command;
      writeFileIfChanged(path.resolve(config.root, options.typesFile), generateTypes(options.manifest));
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const forbidden = findForbiddenHeadTags(html);
        if (forbidden.length > 0) {
          throw new Error(
            `[srgb-effect] index.html must not contain ${forbidden.join(', ')}: these are generated from the srgbEffect() options.`,
          );
        }
        // In builds the head is injected as the final string pass (buildPlugin), after inlining.
        return command === 'serve' ? injectIntoHead(html, serializeHead(options.manifest)) : html;
      },
    },
  };
}
```

`packages/srgb-effect-kit/src/vite/index.ts`:
```ts
import type { Plugin } from 'vite';
import { assertValidManifest, type PropertyDef } from '../shared';
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
  return [corePlugin(resolved)];
}
```

- [ ] **Step 5: Run tests and typecheck to verify they pass**

Run: `pnpm --filter srgb-effect-kit test src/vite test/corePlugin.test.ts && pnpm --filter srgb-effect-kit typecheck && pnpm lint`
Expected: PASS. `index.test-d.ts` compiles, and its `@ts-expect-error` is consumed.

If the `@ts-expect-error` reports "unused", the `CheckedProperties` inference did not apply. Try `properties?: P & { readonly [K in keyof P]: CheckListDefault<P[K]> }` written inline in the parameter type. If it still fails, delete the `@ts-expect-error` case and note in the README that runtime validation catches the list-default mistake. Runtime validation (Task 3) remains the guarantee.

- [ ] **Step 6: Commit**

```bash
git add packages/srgb-effect-kit/src/vite packages/srgb-effect-kit/test
git commit -m "feat(vite): add plugin core with typegen and dev head injection" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Single-file build

**Files:**
- Create: `packages/srgb-effect-kit/src/vite/inline.ts`, `packages/srgb-effect-kit/src/vite/buildPlugin.ts`
- Modify: `packages/srgb-effect-kit/src/vite/index.ts` (add `buildPlugin(resolved)` to the returned array)
- Test: `packages/srgb-effect-kit/src/vite/inline.test.ts`, `packages/srgb-effect-kit/test/buildPlugin.test.ts`

**Interfaces:**
- Consumes:
  - `ResolvedOptions` (Task 10)
  - From `../shared`: `serializeHead`, `injectIntoHead`, `injectBeforeBodyEnd`, `generatePrelude`
- Produces:
  - `InlineResult { html: string; scripts: string[]; inlined: Set<string>; external: string[] }`
  - `inlineAssets(html: string, resolve: (url: string) => { fileName: string; content: string } | undefined): InlineResult`. It removes `<script src>` tags (collecting their code into `scripts`) and replaces stylesheet `<link>` tags with `<style>`.
  - `scriptTag(code: string, kind: 'classic' | 'module'): string`
  - `buildPlugin(options: ResolvedOptions): Plugin`

- [ ] **Step 1: Write the failing unit tests for the inliner**

`packages/srgb-effect-kit/src/vite/inline.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { inlineAssets, scriptTag } from './inline';

const files: Record<string, string> = {
  'assets/index.js': 'console.log("</script>")',
  'assets/style.css': 'body{content:"</style>"}',
};
const resolve = (url: string) => {
  const fileName = url.replace(/^\.?\//, '');
  return fileName in files ? { fileName, content: files[fileName]! } : undefined;
};

describe('inlineAssets', () => {
  it('removes script tags, collecting code, and inlines stylesheets in place', () => {
    const result = inlineAssets(
      '<head><script type="module" crossorigin src="/assets/index.js"></script>\n<link rel="stylesheet" crossorigin href="./assets/style.css"></head>',
      resolve,
    );
    // The script tag and its trailing whitespace are removed; the stylesheet is inlined in place.
    expect(result.html).toBe('<head><style>body{content:"<\\/style>"}</style></head>');
    expect(result.scripts).toEqual(['console.log("</script>")']);
    expect([...result.inlined].sort()).toEqual(['assets/index.js', 'assets/style.css']);
    expect(result.external).toEqual([]);
  });

  it('leaves unresolvable URLs untouched and reports them', () => {
    const html = '<script src="https://cdn.example/x.js"></script><link rel="stylesheet" href="https://cdn.example/x.css">';
    const result = inlineAssets(html, resolve);
    expect(result.html).toBe(html);
    expect(result.external).toEqual(['https://cdn.example/x.js', 'https://cdn.example/x.css']);
  });
});

describe('scriptTag', () => {
  it('escapes closing script tags in code', () => {
    expect(scriptTag('a("</script>")', 'classic')).toBe('<script>\na("<\\/script>")\n</script>');
    expect(scriptTag('a()', 'module')).toBe('<script type="module">\na()\n</script>');
  });
});
```

- [ ] **Step 2: Write the failing integration tests**

`packages/srgb-effect-kit/test/buildPlugin.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest';
import { srgbEffect, type SrgbEffectOptions } from '../src/vite';
import { buildFixture, cleanupFixtures, createFixture } from './helpers/fixture';

afterEach(cleanupFixtures);

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const options: SrgbEffectOptions = {
  title: 'Build Test',
  publisher: 'me',
  properties: [{ property: 'speed', type: 'number', label: 'Speed', min: 0, max: 10, default: 5 }],
  meters: [
    {
      meter: 'health',
      type: 'linear',
      x: 0.1,
      y: 0.1,
      width: 0.2,
      h: [0, 360],
      s: [0, 100],
      l: [0, 100],
      resolutions: [{ size: '1920x1080', x: 0.2 }],
    },
  ],
};

const project = (main: string, html?: string) =>
  createFixture({
    'index.html':
      html ??
      '<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"></head><body><canvas width="320" height="200"></canvas><script type="module" src="/src/main.ts"></script></body></html>',
    'src/style.css': 'body { margin: 0; background: url(./dot.png); }',
    'src/dot.png': PNG,
    'src/main.ts': main,
  });

const buildOnly = async (root: string, opts: Partial<SrgbEffectOptions> = {}, base?: string) => {
  const { files, warnings } = await buildFixture(root, { base, plugins: [srgbEffect({ ...options, ...opts })] });
  return { files, warnings, html: files.get(opts.fileName ?? 'build-test.html') ?? '' };
};

describe('srgbEffect build', () => {
  it('emits exactly one self-contained HTML file', async () => {
    const { files, html } = await buildOnly(project('document.title = String(window.speed);'));
    expect([...files.keys()]).toEqual(['build-test.html']);
    expect(html).not.toMatch(/\ssrc=|<link/);
    expect(html).toMatch(/<style>[^<]*data:image\/png;base64,/);
  });

  it('injects head markup first, with non-void meters', async () => {
    const { html } = await buildOnly(project('document.title = "x";'));
    expect(html).toMatch(/<head>\n<title>Build Test<\/title>\n<meta publisher="me" \/>\n<meta property="speed"/);
    expect(html).toContain('<meta meter="health" type="linear" x="0.1" y="0.1" width="0.2" h="0-360" s="0-100" l="0-100">\n  <resolution size="1920x1080" x="0.2" />\n</meta>');
  });

  it('places the prelude then an IIFE classic script at the end of body', async () => {
    const { html } = await buildOnly(project('document.title = "x";'));
    const body = html.slice(html.indexOf('<canvas'));
    expect(body).toMatch(/^<canvas[^>]*><\/canvas>\n<script>\n\(function\(\)\{var w=window,n=\["onSpeedChanged","onCanvasApiEvent"\]/);
    expect(body).toMatch(/<\/script>\n<script>\n\(function\(\)/);
    expect(html).not.toContain('type="module"');
    expect(html.trimEnd()).toMatch(/<\/script>\n<\/body><\/html>$/);
  });

  it('drops console calls by default and keeps them when disabled', async () => {
    const main = 'console.log("noisy"); document.title = "x";';
    expect((await buildOnly(project(main))).html).not.toContain('noisy');
    expect((await buildOnly(project(main), { dropConsole: false })).html).toContain('noisy');
  });

  it('emits a module script when script is "module"', async () => {
    const { html } = await buildOnly(project('document.title = "x";'), { script: 'module' });
    expect(html).toContain('<script type="module">');
  });

  it('rejects import.meta in classic scripts', async () => {
    await expect(buildOnly(project('document.title = import.meta.url;'))).rejects.toThrow(/uses import\.meta/);
  });

  it('allows import.meta.env, which Vite replaces statically', async () => {
    const { html } = await buildOnly(project('document.title = import.meta.env.MODE;'));
    expect(html).toContain('production');
  });

  it('inlines dynamic imports without import.meta leftovers', async () => {
    const root = createFixture({
      'index.html': '<body><script type="module" src="/main.ts"></script></body>',
      'main.ts': 'import("./lazy").then((m) => { document.title = m.value; });',
      'lazy.ts': 'export const value = "lazy";',
    });
    const { files, html } = await buildOnly(root);
    expect([...files.keys()]).toEqual(['build-test.html']);
    expect(html).toContain('lazy');
    expect(html).not.toContain('import.meta');
  });

  it('escapes closing tags inside inlined code', async () => {
    const { html } = await buildOnly(project('document.title = "</script><b>";'));
    expect(html).toContain('<\\/script><b>');
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });

  it('resolves assets with a relative base', async () => {
    const { files } = await buildOnly(project('document.title = "x";'), {}, './');
    expect([...files.keys()]).toEqual(['build-test.html']);
  });

  it('resolves assets with a sub-path base', async () => {
    const { files } = await buildOnly(project('document.title = "x";'), {}, '/sub/');
    expect([...files.keys()]).toEqual(['build-test.html']);
  });

  it('handles docs-style html without head or html wrapper', async () => {
    const root = project('document.title = "x";', '<body><canvas></canvas><script type="module" src="/src/main.ts"></script></body>');
    const { html } = await buildOnly(root);
    expect(html.indexOf('<title>Build Test</title>')).toBeLessThan(html.indexOf('<body'));
    expect(html).toMatch(/<script>\n\(function\(\)/);
  });

  it('uses the fileName option', async () => {
    const { files } = await buildOnly(project('document.title = "x";'), { fileName: 'custom.html' });
    expect([...files.keys()]).toEqual(['custom.html']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/vite/inline.test.ts test/buildPlugin.test.ts`
Expected: FAIL, because `./inline` is not found and the build tests find no `build-test.html`.

- [ ] **Step 4: Implement the inliner**

`packages/srgb-effect-kit/src/vite/inline.ts`:
```ts
export interface ResolvedAsset {
  fileName: string;
  content: string;
}

export interface InlineResult {
  /** HTML with script tags removed and stylesheets inlined. */
  html: string;
  /** Code of the removed scripts, in document order. */
  scripts: string[];
  /** Bundle file names that were inlined. */
  inlined: Set<string>;
  /** URLs that could not be resolved from the bundle and were left in place. */
  external: string[];
}

const SCRIPT_SRC = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>\s*/gi;
const STYLESHEET = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
const HREF = /\bhref=["']([^"']+)["']/i;

const escapeClosing = (code: string, tag: 'script' | 'style') =>
  code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');

export function inlineAssets(html: string, resolve: (url: string) => ResolvedAsset | undefined): InlineResult {
  const scripts: string[] = [];
  const inlined = new Set<string>();
  const external: string[] = [];

  let out = html.replace(SCRIPT_SRC, (tag: string, url: string) => {
    const asset = resolve(url);
    if (!asset) {
      external.push(url);
      return tag;
    }
    inlined.add(asset.fileName);
    scripts.push(asset.content);
    return '';
  });

  out = out.replace(STYLESHEET, (tag: string) => {
    const url = HREF.exec(tag)?.[1];
    const asset = url === undefined ? undefined : resolve(url);
    if (!asset) {
      if (url !== undefined) external.push(url);
      return tag;
    }
    inlined.add(asset.fileName);
    return `<style>${escapeClosing(asset.content, 'style')}</style>`;
  });

  return { html: out, scripts, inlined, external };
}

export const scriptTag = (code: string, kind: 'classic' | 'module'): string =>
  `<script${kind === 'module' ? ' type="module"' : ''}>\n${escapeClosing(code, 'script')}\n</script>`;
```

- [ ] **Step 5: Implement the build plugin**

`packages/srgb-effect-kit/src/vite/buildPlugin.ts`:
```ts
import type { Plugin, Rolldown } from 'vite';
import { generatePrelude, injectBeforeBodyEnd, injectIntoHead, serializeHead } from '../shared';
import { inlineAssets, scriptTag } from './inline';
import type { ResolvedOptions } from './options';

export function buildPlugin(options: ResolvedOptions): Plugin {
  let base = '/';

  return {
    name: 'srgb-effect:build',
    apply: 'build',
    enforce: 'post',

    config() {
      return {
        build: {
          target: options.target,
          assetsInlineLimit: () => true,
          cssCodeSplit: false,
          modulePreload: false,
          copyPublicDir: false,
          rolldownOptions: {
            output: {
              codeSplitting: false,
              ...(options.script === 'classic' ? { format: 'iife' as const } : {}),
              ...(options.dropConsole ? { minify: { compress: { dropConsole: true, dropDebugger: true } } } : {}),
            },
          },
        },
      };
    },

    configResolved(config) {
      base = config.base;
    },

    onLog(_level, log) {
      if (log.code !== 'EMPTY_IMPORT_META') return;
      // Vite's own helpers (virtual \0 modules) reference import.meta in dead code paths; user code must not.
      if (options.script === 'classic' && log.id && !log.id.startsWith('\0')) {
        this.error(
          `[srgb-effect] ${log.id} uses import.meta, which is unavailable in classic scripts. Remove it (import.meta.env is fine) or set script: 'module'.`,
        );
      }
      return false;
    },

    generateBundle(_outputOptions, bundle) {
      const htmlFiles = Object.values(bundle).filter(
        (file): file is Rolldown.OutputAsset => file.type === 'asset' && file.fileName.endsWith('.html'),
      );
      if (htmlFiles.length !== 1) {
        this.error(`[srgb-effect] expected exactly one HTML entry, found ${htmlFiles.length}`);
      }
      const htmlFile = htmlFiles[0]!;

      const toFileName = (url: string) => {
        let name = url.split(/[?#]/)[0]!;
        if (base !== './' && base !== '' && name.startsWith(base)) name = name.slice(base.length);
        return name.replace(/^\.?\//, '');
      };
      const result = inlineAssets(String(htmlFile.source), (url) => {
        const file = bundle[toFileName(url)];
        if (!file) return undefined;
        return { fileName: file.fileName, content: file.type === 'chunk' ? file.code : String(file.source) };
      });
      for (const url of result.external) {
        this.warn(`[srgb-effect] ${url} is not part of the bundle and was left as an external reference`);
      }

      const scripts = [scriptTag(generatePrelude(options.manifest), 'classic')];
      for (const code of result.scripts) scripts.push(scriptTag(code, options.script));
      let html = injectBeforeBodyEnd(result.html, scripts.join('\n'));
      // Final string pass: meters need non-void <meta> … </meta>, which an HTML parser would mangle.
      html = injectIntoHead(html, serializeHead(options.manifest));

      for (const fileName of result.inlined) delete bundle[fileName];
      delete bundle[htmlFile.fileName];
      const leftovers = Object.keys(bundle);
      if (leftovers.length > 0) {
        this.error(`[srgb-effect] build produced files that could not be inlined: ${leftovers.join(', ')}`);
      }
      this.emitFile({ type: 'asset', fileName: options.fileName, source: html });
    },
  };
}
```

Modify `packages/srgb-effect-kit/src/vite/index.ts`: add `import { buildPlugin } from './buildPlugin';` and change the return to:
```ts
  return [corePlugin(resolved), buildPlugin(resolved)];
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter srgb-effect-kit test src/vite test && pnpm lint && pnpm --filter srgb-effect-kit typecheck`
Expected: PASS.

If a build test fails, check these behaviours, all verified in a spike against vite 8.3.4:
- Vite moves the entry `<script>` into `<head>`; the inliner removes it wherever it is.
- Rolldown's IIFE output starts with `(function(){`.
- `EMPTY_IMPORT_META` carries `log.id` (the module path).
- Deleting bundle keys and then calling `this.emitFile` in `generateBundle` works.
- With `base: './'`, URLs look like `./assets/…`.

- [ ] **Step 7: Commit**

```bash
git add packages/srgb-effect-kit/src/vite packages/srgb-effect-kit/test
git commit -m "feat(vite): build effects into a single self-contained HTML file" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Module-scope handler warning

**Files:**
- Create: `packages/srgb-effect-kit/src/vite/moduleScopePlugin.ts`
- Modify: `packages/srgb-effect-kit/src/vite/index.ts` (add `moduleScopePlugin(resolved)` to the returned array)
- Test: `packages/srgb-effect-kit/src/vite/moduleScopePlugin.test.ts`, `packages/srgb-effect-kit/test/moduleScope.test.ts`

**Interfaces:**
- Consumes:
  - `ResolvedOptions` (Task 10)
  - `handlerName` (shared)
  - `parseSync` from `vite`
- Produces:
  - `findModuleScopedHandlers(code: string, fileName: string, names: ReadonlySet<string>): string[]`
  - `moduleScopePlugin(options: ResolvedOptions): Plugin`

- [ ] **Step 1: Write the failing tests**

`packages/srgb-effect-kit/src/vite/moduleScopePlugin.test.ts`:
```ts
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
    expect(findModuleScopedHandlers(code, 'main.ts', names)).toEqual(['onSpeedChanged', 'onCanvasApiEvent']);
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
```

`packages/srgb-effect-kit/test/moduleScope.test.ts`:
```ts
import { afterEach, describe, expect, it } from 'vitest';
import { srgbEffect } from '../src/vite';
import { buildFixture, cleanupFixtures, createFixture } from './helpers/fixture';

afterEach(cleanupFixtures);

const plugins = () => [
  srgbEffect({
    title: 'Scope',
    properties: [{ property: 'speed', type: 'number', label: 'Speed', min: 0, max: 1, default: 0 }],
  }),
];

const root = (main: string) =>
  createFixture({
    'index.html': '<body><script type="module" src="/main.ts"></script></body>',
    'main.ts': main,
  });

describe('module-scope handler warning', () => {
  it('warns about module-scoped handler functions', async () => {
    const { warnings } = await buildFixture(root('function onSpeedChanged() { document.title = "x"; }\nonSpeedChanged();'), { plugins: plugins() });
    expect(warnings.join('\n')).toMatch(/"function onSpeedChanged\(\)" is module-scoped .* window\.onSpeedChanged = /s);
  });

  it('stays quiet for window assignments', async () => {
    const { warnings } = await buildFixture(root('window.onSpeedChanged = () => { document.title = "x"; };'), { plugins: plugins() });
    expect(warnings.join('\n')).not.toMatch(/module-scoped/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter srgb-effect-kit test src/vite/moduleScopePlugin.test.ts test/moduleScope.test.ts`
Expected: FAIL. The module is not found, and no warning is produced.

- [ ] **Step 3: Implement**

`packages/srgb-effect-kit/src/vite/moduleScopePlugin.ts`:
```ts
import path from 'node:path';
import { parseSync, type Plugin } from 'vite';
import { handlerName } from '../shared';
import type { ResolvedOptions } from './options';

const SCRIPT_FILE = /\.(?:[cm]?[jt]sx?)$/;

const langFor = (fileName: string): 'js' | 'jsx' | 'ts' | 'tsx' => {
  if (fileName.endsWith('.tsx')) return 'tsx';
  if (fileName.endsWith('.jsx')) return 'jsx';
  return /\.[cm]?ts$/.test(fileName) ? 'ts' : 'js';
};

interface Node {
  type: string;
  id?: { name?: string } | null;
  declaration?: Node | null;
}

/** Names of top-level `function <handler>() {}` declarations, which SignalRGB can never call from a module. */
export function findModuleScopedHandlers(code: string, fileName: string, names: ReadonlySet<string>): string[] {
  const result = parseSync(fileName, code, { lang: langFor(fileName), sourceType: 'module' });
  if (result.errors.length > 0) return [];
  const found: string[] = [];
  for (const statement of result.program.body as unknown as Node[]) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    const name = declaration?.type === 'FunctionDeclaration' ? declaration.id?.name : undefined;
    if (name !== undefined && names.has(name)) found.push(name);
  }
  return found;
}

export function moduleScopePlugin(options: ResolvedOptions): Plugin {
  const names = new Set([
    ...(options.manifest.properties ?? []).map((p) => handlerName(p.property)),
    'onCanvasApiEvent',
  ]);
  let root = process.cwd();

  return {
    name: 'srgb-effect:module-scope-check',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      const file = id.split('?')[0]!;
      if (id.startsWith('\0') || file.includes('/node_modules/') || !SCRIPT_FILE.test(file)) return null;
      for (const name of findModuleScopedHandlers(code, file, names)) {
        this.warn(
          `[srgb-effect] ${path.relative(root, file)}: "function ${name}()" is module-scoped and will never be called by SignalRGB. Assign it instead: window.${name} = () => { … }`,
        );
      }
      return null;
    },
  };
}
```

Modify `packages/srgb-effect-kit/src/vite/index.ts`: add `import { moduleScopePlugin } from './moduleScopePlugin';` and change the return to:
```ts
  return [corePlugin(resolved), buildPlugin(resolved), moduleScopePlugin(resolved)];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter srgb-effect-kit test && pnpm lint && pnpm --filter srgb-effect-kit typecheck`
Expected: the whole package suite passes.

If the integration test sees no warning, print `warnings` in a scratch run. Vite formats plugin warnings as `[plugin srgb-effect:module-scope-check] …`, and the regex only needs the message substring.

- [ ] **Step 5: Commit**

```bash
git add packages/srgb-effect-kit/src/vite packages/srgb-effect-kit/test
git commit -m "feat(vite): warn about module-scoped SignalRGB handlers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Package build, examples and README

**Files:**
- Create: `examples/basic-2d/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.ts}`
- Create: `examples/audio-visualizer/{package.json,tsconfig.json,vite.config.ts,index.html,src/main.ts}`
- Create (generated by the first build, committed): `examples/*/src/srgb-effect.d.ts`
- Create: `packages/srgb-effect-kit/README.md`, `examples/basic-2d/README.md`, `examples/audio-visualizer/README.md`

**Interfaces:**
- Consumes the public API only:
  - `srgb-effect-kit`: `getCanvas`, `createLoop`, `hsl`, `hexToHsl`, `parseBoolean`, `getFrequencies`, `isSilent`
  - `srgb-effect-kit/vite`: `srgbEffect`

- [ ] **Step 1: Build the package and verify its exports**

Run: `pnpm --filter srgb-effect-kit build && ls packages/srgb-effect-kit/dist/runtime packages/srgb-effect-kit/dist/vite`
Expected: `index.js` and `index.d.ts` in both directories. If tsdown emitted `.mjs`/`.d.mts`, `fixedExtension: false` was ignored. In that case set `outExtensions: () => ({ js: '.js', dts: '.d.ts' })` in both configs and rebuild.

Run: `grep -c "from \"vite\"\|from 'vite'" packages/srgb-effect-kit/dist/vite/index.js`
Expected: ≥ 1. Vite must stay external, not bundled.

Run: `grep -c "node:" packages/srgb-effect-kit/dist/runtime/index.js || true`
Expected: `0`.

- [ ] **Step 2: Create the basic-2d example**

`examples/basic-2d/package.json`:
```json
{
  "name": "@srgb-effect-kit-examples/basic-2d",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "srgb-effect-kit": "workspace:*",
    "typescript": "~6.0.3",
    "vite": "^8.3.4"
  }
}
```

`examples/basic-2d/tsconfig.json` (use the same file for audio-visualizer):
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`examples/basic-2d/vite.config.ts`:
```ts
import { srgbEffect } from 'srgb-effect-kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    srgbEffect({
      title: 'Basic 2D',
      description: 'Rainbow wave rendered on a 2D canvas',
      publisher: 'srgb-effect-kit',
      properties: [
        { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 25 },
        { property: 'baseHue', type: 'hue', label: 'Base hue', default: 200 },
        { property: 'rainbow', type: 'boolean', label: 'Rainbow', default: true },
        { property: 'mode', type: 'list', label: 'Mode', values: ['Wave', 'Pulse'], default: 'Wave' },
      ],
    }),
  ],
});
```

`examples/basic-2d/index.html`:
```html
<!doctype html>
<html>
  <head>
    <style>
      body {
        margin: 0;
        background: #000;
      }
    </style>
  </head>
  <body>
    <canvas width="320" height="200"></canvas>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`examples/basic-2d/src/main.ts`:
```ts
import { createLoop, getCanvas, hsl, parseBoolean } from 'srgb-effect-kit';

const { ctx } = getCanvas();
const COLUMN = 4;
let hue = baseHue;

// SignalRGB calls this on load and whenever the slider moves.
window.onBaseHueChanged = () => {
  hue = baseHue;
};

createLoop(({ dt, time }) => {
  hue = (hue + speed * 3.6 * dt) % 360;
  const lightness = mode === 'Pulse' ? 35 + 15 * Math.sin(time * 4) : 50;

  for (let x = 0; x < 320; x += COLUMN) {
    const offset = mode === 'Wave' ? (x / 320) * 360 : 0;
    ctx.fillStyle = hsl(parseBoolean(rainbow) ? (hue + offset) % 360 : baseHue, 100, lightness);
    ctx.fillRect(x, 0, COLUMN, 200);
  }
}).start();
```

- [ ] **Step 3: Create the audio-visualizer example**

`examples/audio-visualizer/package.json`: identical to basic-2d, except `"name": "@srgb-effect-kit-examples/audio-visualizer"`.
`examples/audio-visualizer/tsconfig.json` and `index.html`: identical to basic-2d.

`examples/audio-visualizer/vite.config.ts`:
```ts
import { srgbEffect } from 'srgb-effect-kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    srgbEffect({
      title: 'Audio Visualizer',
      description: 'Frequency bars driven by engine.audio',
      publisher: 'srgb-effect-kit',
      properties: [
        { property: 'tint', type: 'color', label: 'Bar color', default: '#009bde' },
        { property: 'gain', type: 'number', label: 'Gain', min: 0, max: 100, default: 50 },
        { property: 'hueSpread', type: 'number', label: 'Hue spread', min: 0, max: 100, default: 0 },
      ],
    }),
  ],
});
```

`examples/audio-visualizer/src/main.ts`:
```ts
import { createLoop, getCanvas, getFrequencies, hexToHsl, hsl, isSilent } from 'srgb-effect-kit';

const { ctx } = getCanvas();
const BARS = 40;
const BAR_WIDTH = 320 / BARS;

createLoop(() => {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 320, 200);
  if (isSilent()) return;

  const freq = getFrequencies();
  const base = hexToHsl(tint);
  const binsPerBar = Math.floor(freq.length / BARS);

  for (let bar = 0; bar < BARS; bar += 1) {
    let sum = 0;
    for (let i = 0; i < binsPerBar; i += 1) sum += freq[bar * binsPerBar + i]!;
    const level = Math.min(1, (sum / binsPerBar / 255) * (gain / 50));
    const height = level * 200;
    ctx.fillStyle = hsl((base.h + (bar * hueSpread) / 10) % 360, base.s, base.l);
    ctx.fillRect(bar * BAR_WIDTH, 200 - height, BAR_WIDTH - 1, height);
  }
}).start();
```

- [ ] **Step 4: Install, build the examples (which generates the types files) and check the output**

Run: `pnpm install && pnpm -r build`
Expected:
- `examples/basic-2d/dist/basic-2d.html` and `examples/audio-visualizer/dist/audio-visualizer.html` exist, and each `dist/` holds only that file.
- `examples/*/src/srgb-effect.d.ts` were written.

Run: `ls examples/basic-2d/dist && grep -c '<meta property=' examples/basic-2d/dist/basic-2d.html`
Expected: `basic-2d.html`, then `4`.

Run: `pnpm typecheck`
Expected: PASS. This verifies `client.d.ts` and the generated globals typings: `speed`, `baseHue`, `rainbow`, `mode`, `window.onBaseHueChanged`, `tint`, `gain` and `hueSpread` must all type-check.

- [ ] **Step 5: Smoke-check dev mode**

Run, in the background: `pnpm --filter @srgb-effect-kit-examples/basic-2d dev --port 5179 --strictPort`
Then run: `curl -s http://localhost:5179/ | grep -c '<meta property='`
Expected: `4`. Stop the dev server afterwards.

- [ ] **Step 6: Write the READMEs**

`packages/srgb-effect-kit/README.md`:
````markdown
# srgb-effect-kit

Build [SignalRGB](https://signalrgb.com/) effects (Lightscripts) with Vite and TypeScript.

- Declare the effect's metadata, controls and screen meters once, in `vite.config.ts`.
- Get typed globals for every property and `on<Property>Changed` handler.
- `vite build` produces one self-contained HTML file to drop into SignalRGB.

## Setup

```sh
pnpm add -D srgb-effect-kit vite typescript
```

```ts
// vite.config.ts
import { srgbEffect } from 'srgb-effect-kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    srgbEffect({
      title: 'My Effect',
      description: 'What it does',
      publisher: 'you',
      properties: [
        { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 100, default: 50 },
        { property: 'mode', type: 'list', label: 'Mode', values: ['Wave', 'Pulse'], default: 'Wave' },
      ],
    }),
  ],
});
```

`index.html` contains only your body: a canvas, other DOM, or nothing at all. Do not write `<title>` or SignalRGB `<meta>` tags; the plugin generates them.

## Globals

SignalRGB injects each property as a global and calls `on<Property>Changed` once at load and whenever the user changes the value.

The plugin writes `src/srgb-effect.d.ts`, which types all of these. Commit it.

```ts
window.onSpeedChanged = () => console.log(speed); // speed: number
```

**Do not declare `function onSpeedChanged() {}` at the top of a module.** Module code is not global, so SignalRGB never calls it. The plugin warns when it finds one. Assign to `window` instead; bare assignment (`onSpeedChanged = …`) works too.

## Options

| Option | Default | |
|---|---|---|
| `title`, `description`, `publisher` | | Effect metadata |
| `properties` | `[]` | Controls, in UI order: `number`, `hue`, `boolean`, `color`, `textfield`, `list` |
| `meters` | `[]` | Screen meters: `linear`, `area`, `ocr_textmatch`, `ocr_numeric`, with `resolutions`, `hdr` and `tags` |
| `typesFile` | `src/srgb-effect.d.ts` | Generated typings path |
| `fileName` | kebab-cased title + `.html` | Build output name |
| `script` | `'classic'` | `'classic'` emits an IIFE in `<script>`; `'module'` emits `<script type="module">` |
| `dropConsole` | `true` | Removes `console.*`. SignalRGB requires a clean console. |
| `target` | `'es2020'` | Build target |

## Utilities

```ts
import { createLoop, getCanvas, hsl, isSilent, getFrequencies, getZone, createMeter, detectRenderer } from 'srgb-effect-kit';
```

| Area | Exports |
|---|---|
| Canvas | `getCanvas({ id?, context? })` |
| Loop | `createLoop(frame, { maxFps? })`, where `frame` receives `{ dt, time, frameCount }` |
| Renderer | `detectRenderer()` returns `'ultralight' \| 'qtwebengine' \| 'browser'`; also `isSignalRGB()` |
| Audio | `isSilent()`, `getFrequencies()` |
| Screen | `getZone(x, y)` and `getZones()` over the 28×20 grid |
| Meters | `createMeter(size, callback)`, which debounces `engine.vision.<meter>` readings |
| Color | `hexToRgb`, `rgbToHex`, `rgbToHsl`, `hslToRgb`, `hexToHsl`, `hslToHex`, `hsl()`, `rgb()`, `lerpColor()` |
| Booleans | `parseBoolean()` |

## Renderers and frame rate

SignalRGB renders effects with either UltraLight or QtWebEngine, chosen by the user.

SignalRGB's FPS setting (20–60) is not exposed to effects:
- UltraLight's `requestAnimationFrame` follows the setting.
- QtWebEngine runs at 60 Hz while SignalRGB samples frames at the setting's rate.

Only the top-left 320×200 of the page is shown.
````

`examples/basic-2d/README.md`:
```markdown
# basic-2d

Rainbow wave on a 2D canvas: number, hue, boolean and list controls, with `createLoop`.

- `pnpm dev`: develop in the browser.
- `pnpm build`: writes `dist/basic-2d.html`. Copy it into SignalRGB's effects folder and restart SignalRGB.
```

`examples/audio-visualizer/README.md`:
```markdown
# audio-visualizer

Frequency bars from `engine.audio`, using `isSilent`, `getFrequencies` and color utilities.

- `pnpm dev`: develop in the browser. Audio mocks arrive with devtools (Plan 2); until then the bars stay empty.
- `pnpm build`: writes `dist/audio-visualizer.html`.
```

- [ ] **Step 7: Run the full pipeline as CI does**

Run: `pnpm lint && pnpm format && pnpm build && pnpm typecheck && pnpm test`
Expected: all pass. Run `pnpm format:fix` first if Prettier flags new files.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add examples and package documentation" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Follow-up plans

- **Plan 2: Devtools** (spec §10). This covers:
  - the bootstrap and `fireChangedOnLoad`;
  - the visible-area marker;
  - the Shadow DOM drawer with these tabs: Properties, Audio, Screen, Meters, Canvas API, Renderer, SignalRGB view, Console;
  - the dev-server `POST /canvas/event` relay.

  It hooks into `srgbEffect()` as a fourth plugin with `apply: 'serve'`.
- **Plan 3: Probe** (spec §9). This covers the probe example effect, the `POST /__srgb-effect/probe` endpoint, `probe-results/` and `docs/probe-findings.md`. Its findings update `RENDERER_SIGNATURES`, `SRGBBoolean`, the `target` default and the `getFrequencies` range.
