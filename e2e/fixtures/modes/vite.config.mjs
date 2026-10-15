// Serves this fixture with the devtools mode from SRGB_DEVTOOLS_MODE ('none' or 'minimal'). It
// loads the built plugin directly, so run `pnpm build` first.
import { srgbEffect } from '../../../packages/srgb-effect-kit/dist/vite/index.js';

export default {
  root: import.meta.dirname,
  logLevel: 'warn',
  plugins: [
    srgbEffect({
      title: 'Modes Fixture',
      properties: [
        { property: 'speed', type: 'number', label: 'Speed', min: 0, max: 10, default: 5 },
      ],
      devtools: process.env.SRGB_DEVTOOLS_MODE,
    }),
  ],
};
