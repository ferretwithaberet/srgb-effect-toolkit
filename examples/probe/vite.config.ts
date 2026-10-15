import { srgbEffect } from 'srgb-effect-kit/vite';
import { defineConfig } from 'vite';
import { sharedOptions } from './src/manifest.ts';

// Module build (the toolkit's default script mode). `pnpm dev` also uses this config.
export default defineConfig({
  define: { 'import.meta.env.PROBE_BUILD': JSON.stringify('module') },
  plugins: [srgbEffect({ ...sharedOptions, title: 'SRGB Probe', fileName: 'probe.html' })],
});
