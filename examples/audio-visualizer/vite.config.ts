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
        {
          property: 'hueSpread',
          type: 'number',
          label: 'Hue spread',
          min: 0,
          max: 100,
          default: 0,
        },
      ],
    }),
  ],
});
