import { srgbEffect } from 'srgb-effect-kit/vite';
import { defineConfig } from 'vite';
import { sharedOptions } from './src/manifest.ts';

// Classic build: the same probe as an IIFE in a plain <script>, under its own title so both show
// up in SignalRGB. It runs after vite.config.ts, so it must keep that build's output.
export default defineConfig({
  define: { 'import.meta.env.PROBE_BUILD': JSON.stringify('classic') },
  build: { emptyOutDir: false },
  plugins: [
    srgbEffect({
      ...sharedOptions,
      title: 'SRGB Probe Classic',
      fileName: 'probe-classic.html',
      script: 'classic',
    }),
  ],
});
