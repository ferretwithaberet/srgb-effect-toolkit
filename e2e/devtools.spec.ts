import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  collectPageErrors,
  MODE_PORTS,
  openEffect,
  probeGlobalsAtUserStart,
  recordHandlerCalls,
} from './helpers';

const EXAMPLE = path.resolve(import.meta.dirname, '../examples/basic-2d');

test('defines SignalRGB globals before the effect code runs', async ({ page }) => {
  const errors = collectPageErrors(page);
  await probeGlobalsAtUserStart(page, ['speed', 'baseHue', 'rainbow', 'mode', 'engine']);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await openEffect(page);
  expect(await page.evaluate(() => window.__atUserStart)).toEqual({
    speed: 'number',
    baseHue: 'number',
    rainbow: 'string',
    mode: 'string',
    engine: 'object',
    onSpeedChanged: true,
  });
  // Raw values: the defaults declared by basic-2d (a boolean is the raw string '1').
  expect(await page.evaluate(() => [window.speed, window.rainbow, window.mode])).toEqual([
    25,
    '1',
    'Wave',
  ]);
  // Full mode loads the full bundle, never the minimal one (mirror of the 'minimal' test).
  expect(requests.some((url) => url.endsWith('/devtools/index.js'))).toBe(true);
  expect(requests.some((url) => url.endsWith('/devtools/minimal.js'))).toBe(false);
  expect(errors).toEqual([]);
});

test('calls the assigned change handlers once on load', async ({ page }) => {
  await recordHandlerCalls(page, [
    'onSpeedChanged',
    'onBaseHueChanged',
    'onRainbowChanged',
    'onModeChanged',
  ]);
  await openEffect(page);
  // basic-2d assigns only onBaseHueChanged.
  // Load-time calls finish before the load event that openEffect waits for: read once, exactly.
  expect(await page.evaluate(() => window.__handlerCalls)).toEqual(['onBaseHueChanged']);
});

test('relays POST /canvas/event into onCanvasApiEvent', async ({ page }) => {
  await openEffect(page);
  await page.evaluate(() => {
    window.__events = [];
    window.onCanvasApiEvent = (event) => void window.__events.push(event);
  });
  const response = await page.request.post('/canvas/event?sender=e2e&event=hit%20me');
  expect(response.status()).toBe(204);
  await expect
    .poll(() => page.evaluate(() => window.__events))
    .toEqual([{ sender: 'e2e', event: 'hit me' }]);
});

test('leaves no devtools code in the build output', () => {
  execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], { cwd: EXAMPLE });
  const html = fs.readFileSync(path.join(EXAMPLE, 'dist/basic-2d.html'), 'utf8');
  expect(html).toContain('<title>Basic 2D</title>');
  for (const marker of [
    'srgb-effect-devtools',
    'srgb-effect/devtools',
    'srgb-effect-kit:',
    '@id/',
  ]) {
    expect(html).not.toContain(marker);
  }
});

test("devtools 'minimal' simulates SignalRGB without loading any devtools UI", async ({ page }) => {
  const origin = `http://127.0.0.1:${MODE_PORTS.minimal}`;
  const errors = collectPageErrors(page);
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  // Minimal mode ignores stored values: the globals always start at the defaults.
  await page.addInitScript(() =>
    localStorage.setItem('srgb-effect-kit:Modes Fixture:properties', JSON.stringify({ speed: 9 })),
  );
  await openEffect(page, `${origin}/`);
  expect(await page.evaluate(() => window.__atUserStart)).toEqual({
    speed: 'number',
    engine: 'object',
    onSpeedChanged: true,
  });
  await expect.poll(() => page.evaluate(() => window.__speedCalls)).toBe(1);
  expect(await page.evaluate(() => window.speed)).toBe(5);
  await expect(page.locator('srgb-effect-devtools')).toHaveCount(0);
  expect(requests.some((url) => url.includes('/devtools/minimal.js'))).toBe(true);
  expect(requests.some((url) => url.includes('/devtools/index.js'))).toBe(false);

  const response = await page.request.post(`${origin}/canvas/event?sender=e2e&event=ping`);
  expect(response.status()).toBe(204);
  await expect
    .poll(() => page.evaluate(() => window.__events))
    .toEqual([{ sender: 'e2e', event: 'ping' }]);
  expect(errors).toEqual([]);
});

test("devtools 'none' injects nothing", async ({ page }) => {
  const origin = `http://127.0.0.1:${MODE_PORTS.none}`;
  await openEffect(page, `${origin}/`);
  expect(await page.evaluate(() => window.__atUserStart)).toEqual({
    speed: 'undefined',
    engine: 'undefined',
    onSpeedChanged: false,
  });
  await expect(page.locator('srgb-effect-devtools')).toHaveCount(0);
  const response = await page.request.post(`${origin}/canvas/event?sender=e2e&event=ping`);
  expect(response.status()).toBe(404);
});

test('opens and closes the drawer', async ({ page }) => {
  await openEffect(page);
  const panel = page.locator('[data-srgb-devtools="panel"]');
  await expect(panel).toBeHidden();
  await page.locator('[data-srgb-devtools="toggle"]').click();
  await expect(panel).toBeVisible();
  await page.locator('[data-srgb-devtools="close"]').click();
  await expect(panel).toBeHidden();
});
