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
