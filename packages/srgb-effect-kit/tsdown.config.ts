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
  // Internal entries, served to the browser by the plugin in dev and never exported. Separate
  // configs keep each bundle self-contained, so 'minimal' never loads the drawer's code.
  {
    entry: { 'devtools/index': 'src/devtools/index.ts' },
    platform: 'browser',
    format: 'esm',
    dts: false,
    fixedExtension: false,
    clean: false,
  },
  {
    entry: { 'devtools/minimal': 'src/devtools/minimal.ts' },
    platform: 'browser',
    format: 'esm',
    dts: false,
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
