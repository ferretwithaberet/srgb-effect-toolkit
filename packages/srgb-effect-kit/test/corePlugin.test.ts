import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'vite';
import { afterEach, describe, expect, it } from 'vitest';
import { srgbEffect } from '../src/vite';
import { buildFixture, cleanupFixtures, createFixture } from './helpers/fixture';

afterEach(cleanupFixtures);

const options = {
  title: 'Core Test',
  properties: [{ property: 'speed', type: 'number', label: 'Speed', min: 0, max: 10, default: 5 }],
} as const;

describe('srgbEffect core', () => {
  it('validates the manifest when the plugin is created', () => {
    expect(() => srgbEffect({ title: '' })).toThrow(/\[srgb-effect\] Invalid effect manifest/);
  });

  it('writes the generated types file on config resolution', async () => {
    const root = createFixture({ 'index.html': '<body></body>' });
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      plugins: [srgbEffect(options)],
    });
    const typesFile = path.join(root, 'src/srgb-effect.d.ts');
    expect(fs.readFileSync(typesFile, 'utf8')).toContain('var speed: number;');
    await server.close();
  });

  it('injects head markup into index.html while serving', async () => {
    const root = createFixture({
      'index.html': '<!doctype html><html><head></head><body></body></html>',
    });
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      plugins: [srgbEffect(options)],
    });
    const html = await server.transformIndexHtml(
      '/index.html',
      fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
    );
    expect(html).toContain('<title>Core Test</title>');
    expect(html).toContain(
      '<meta property="speed" label="Speed" type="number" min="0" max="10" default="5" />',
    );
    await server.close();
  });

  it('fails the build when index.html hand-writes generated tags', async () => {
    const root = createFixture({
      'index.html':
        '<head><title>Manual</title></head><body><script type="module" src="/main.js"></script></body>',
      'main.js': 'document.body.dataset.x = "1";',
    });
    await expect(buildFixture(root, { plugins: [srgbEffect(options)] })).rejects.toThrow(
      /index\.html must not contain <title>/,
    );
  });
});
