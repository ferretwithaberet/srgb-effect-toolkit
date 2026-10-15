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
