import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import { builtinModules } from 'node:module';
import tseslint from 'typescript-eslint';

// Bare directory/barrel forms ('../vite') are listed next to the deep ones ('../vite/x').
const NODE_AND_VITE = [
  'node:*',
  'vite',
  'vite/*',
  '**/vite',
  '**/vite/**',
  '**/devtools',
  '**/devtools/**',
];
// Unprefixed builtins ('fs', 'fs/promises') as exact paths: as gitignore-style patterns they would
// also match same-named local files such as './events'.
const nodeBuiltins = (message) =>
  builtinModules.filter((name) => !name.startsWith('node:')).map((name) => ({ name, message }));
const RUNTIME_MESSAGE = 'runtime/ ships inside effects: no Node, Vite or devtools imports.';
const SHARED_MESSAGE = 'shared/ is isomorphic: no Node, Vite, runtime or devtools imports.';
const DEVTOOLS_MESSAGE = 'devtools/ runs in the browser: no Node or Vite imports.';
const VITE_MESSAGE = 'vite/ runs in Node: load devtools/ through the dev server, never import it.';

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/*.d.ts',
      '**/*.generated.ts',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['packages/srgb-effect-kit/src/runtime/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeBuiltins(RUNTIME_MESSAGE),
          patterns: [{ group: NODE_AND_VITE, message: RUNTIME_MESSAGE }],
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
          paths: nodeBuiltins(SHARED_MESSAGE),
          patterns: [
            { group: [...NODE_AND_VITE, '**/runtime', '**/runtime/**'], message: SHARED_MESSAGE },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/srgb-effect-kit/src/devtools/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: nodeBuiltins(DEVTOOLS_MESSAGE),
          patterns: [
            {
              group: ['node:*', 'vite', 'vite/*', '**/vite', '**/vite/**'],
              message: DEVTOOLS_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/srgb-effect-kit/src/vite/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['**/devtools', '**/devtools/**'], message: VITE_MESSAGE }] },
      ],
    },
  },
  prettier,
);
