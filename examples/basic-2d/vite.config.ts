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
        {
          property: 'mode',
          type: 'list',
          label: 'Mode',
          values: ['Wave', 'Pulse'],
          default: 'Wave',
        },
      ],
    }),
  ],
});
