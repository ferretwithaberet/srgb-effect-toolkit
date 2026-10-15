import { defineConfig } from '@playwright/test';
import { MODE_PORTS } from './e2e/helpers';

/** Port of the basic-2d dev server (devtools 'full') the end-to-end tests drive. */
const PORT = 5310;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Shared dev servers: run serially so tests never race on a server's WebSocket broadcasts.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    browserName: 'chromium',
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1280, height: 800 },
    // Locally, CHROMIUM_PATH can point at a system Chromium instead of Playwright's download.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // Serves the example against the built package (packages/srgb-effect-kit/dist): build first.
      command: `pnpm --dir examples/basic-2d exec vite --host 127.0.0.1 --port ${PORT} --strictPort`,
      url: `http://127.0.0.1:${PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    // The same small fixture in the 'minimal' and 'none' devtools modes. Vite comes from basic-2d.
    ...(['minimal', 'none'] as const).map((mode) => ({
      command: `pnpm --dir examples/basic-2d exec vite --config ../../e2e/fixtures/modes/vite.config.mjs --host 127.0.0.1 --port ${MODE_PORTS[mode]} --strictPort`,
      url: `http://127.0.0.1:${MODE_PORTS[mode]}/`,
      env: { SRGB_DEVTOOLS_MODE: mode },
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    })),
  ],
});
