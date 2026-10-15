import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { srgbEffect, type SrgbEffectOptions } from '../src/vite';
import { buildFixture, cleanupFixtures, createFixture } from './helpers/fixture';

afterEach(cleanupFixtures);

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const options: SrgbEffectOptions = {
  title: 'Build Test',
  publisher: 'me',
  properties: [{ property: 'speed', type: 'number', label: 'Speed', min: 0, max: 10, default: 5 }],
  meters: [
    {
      meter: 'health',
      type: 'linear',
      x: 0.1,
      y: 0.1,
      width: 0.2,
      h: [0, 360],
      s: [0, 100],
      l: [0, 100],
      resolutions: [{ size: '1920x1080', x: 0.2 }],
    },
  ],
};

const project = (main: string, html?: string) =>
  createFixture({
    'index.html':
      html ??
      '<!doctype html><html><head><link rel="stylesheet" href="/src/style.css"></head><body><canvas width="320" height="200"></canvas><script type="module" src="/src/main.ts"></script></body></html>',
    'src/style.css': 'body { margin: 0; background: url(./dot.png); }',
    'src/dot.png': PNG,
    'src/main.ts': main,
  });

const buildOnly = async (root: string, opts: Partial<SrgbEffectOptions> = {}, base?: string) => {
  const { files, warnings } = await buildFixture(root, {
    base,
    plugins: [srgbEffect({ ...options, ...opts })],
  });
  return { files, warnings, html: files.get(opts.fileName ?? 'build-test.html') ?? '' };
};

describe('srgbEffect build', () => {
  it('emits exactly one self-contained HTML file', async () => {
    const { files, html } = await buildOnly(project('document.title = String(window.speed);'));
    expect([...files.keys()]).toEqual(['build-test.html']);
    expect(html).not.toMatch(/\ssrc=|<link/);
    expect(html).toMatch(/<style>[^<]*data:image\/png;base64,/);
  });

  it('injects head markup first, with non-void meters', async () => {
    const { html } = await buildOnly(project('document.title = "x";'));
    expect(html).toMatch(
      /<head>\n<title>Build Test<\/title>\n<meta publisher="me" \/>\n<meta property="speed"/,
    );
    expect(html).toContain(
      '<meta meter="health" type="linear" x="0.1" y="0.1" width="0.2" h="0-360" s="0-100" l="0-100">\n  <resolution size="1920x1080" x="0.2" />\n</meta>',
    );
  });

  it('places the prelude then an IIFE classic script at the end of body', async () => {
    const { html } = await buildOnly(project('document.title = "x";'));
    const body = html.slice(html.indexOf('<canvas'));
    expect(body).toMatch(
      /^<canvas[^>]*><\/canvas>\n<script>\n\(function\(\)\{var w=window,n=\["onSpeedChanged","onCanvasApiEvent"\]/,
    );
    expect(body).toMatch(/<\/script>\n<script>\n"use strict";\(function\(\)/);
    expect(html).not.toContain('type="module"');
    expect(html.trimEnd()).toMatch(/<\/script>\n<\/body><\/html>$/);
  });

  it('runs classic scripts in strict mode, like modules', async () => {
    const { html } = await buildOnly(project('document.title = "x";'));
    const body = html.slice(html.indexOf('<canvas'));
    const effect = body.slice(body.indexOf('</script>') + '</script>'.length);
    // Rolldown emits the directive just before the IIFE; the script holds nothing else, so the
    // whole effect is strict while the separate prelude script stays sloppy.
    expect(effect).toMatch(/^\n<script>\n["']use strict["'];\(function\(\)\{/);
    expect(body).toMatch(/^<canvas[^>]*><\/canvas>\n<script>\n\(function\(\)\{var w=window/);
  });

  it('drops console calls by default and keeps them when disabled', async () => {
    const main = 'console.log("noisy"); document.title = "x";';
    expect((await buildOnly(project(main))).html).not.toContain('noisy');
    expect((await buildOnly(project(main), { dropConsole: false })).html).toContain('noisy');
  });

  it('emits a module script when script is "module"', async () => {
    const { html } = await buildOnly(project('document.title = "x";'), { script: 'module' });
    expect(html).toContain('<script type="module">');
  });

  it('rejects import.meta in classic scripts', async () => {
    await expect(buildOnly(project('document.title = import.meta.url;'))).rejects.toThrow(
      /uses import\.meta/,
    );
  });

  it('allows import.meta.env, which Vite replaces statically', async () => {
    const { html } = await buildOnly(project('document.title = import.meta.env.MODE;'));
    expect(html).toContain('production');
  });

  it('inlines dynamic imports without import.meta leftovers', async () => {
    const root = createFixture({
      'index.html': '<body><script type="module" src="/main.ts"></script></body>',
      'main.ts': 'import("./lazy").then((m) => { document.title = m.value; });',
      'lazy.ts': 'export const value = "lazy";',
    });
    const { files, html } = await buildOnly(root);
    expect([...files.keys()]).toEqual(['build-test.html']);
    expect(html).toContain('lazy');
    expect(html).not.toContain('import.meta');
  });

  it('escapes closing tags inside inlined code', async () => {
    const { html } = await buildOnly(project('document.title = "</script><b>";'));
    expect(html).toContain('<\\/script><b>');
    expect(html.match(/<\/script>/g)).toHaveLength(2);
  });

  it('resolves assets with a relative base', async () => {
    const { files } = await buildOnly(project('document.title = "x";'), {}, './');
    expect([...files.keys()]).toEqual(['build-test.html']);
  });

  it('resolves assets with a sub-path base', async () => {
    const { files } = await buildOnly(project('document.title = "x";'), {}, '/sub/');
    expect([...files.keys()]).toEqual(['build-test.html']);
  });

  it('handles docs-style html without head or html wrapper', async () => {
    const root = project(
      'document.title = "x";',
      '<body><canvas></canvas><script type="module" src="/src/main.ts"></script></body>',
    );
    const { html } = await buildOnly(root);
    expect(html.indexOf('<title>Build Test</title>')).toBeLessThan(html.indexOf('<body'));
    expect(html).toMatch(/<script>\n"use strict";\(function\(\)/);
  });

  it('uses the fileName option', async () => {
    const { files } = await buildOnly(project('document.title = "x";'), {
      fileName: 'custom.html',
    });
    expect([...files.keys()]).toEqual(['custom.html']);
  });
  it('rejects external side-effect imports in classic scripts', async () => {
    const main = 'import "https://cdn.example/x.js"; document.title = "x";';
    await expect(buildOnly(project(main))).rejects.toThrow(
      /\[srgb-effect\] classic scripts cannot import external modules/,
    );
  });

  it('rejects external named imports in classic scripts', async () => {
    const main =
      'import { thing } from "https://cdn.example/x.js"; document.title = String(thing);';
    await expect(buildOnly(project(main))).rejects.toThrow(
      /\[srgb-effect\] classic scripts cannot import external modules/,
    );
  });

  it('rejects top-level await in classic scripts', async () => {
    const main = 'await Promise.resolve(); document.title = "x";';
    await expect(buildOnly(project(main))).rejects.toThrow(/\[srgb-effect\] top-level await/);
  });

  it('allows top-level await in module scripts', async () => {
    const main = 'await Promise.resolve(); document.title = "x";';
    const { html } = await buildOnly(project(main), { script: 'module' });
    expect(html).toContain('<script type="module">');
  });

  it('warns that public/ files are not part of the single-file effect', async () => {
    const root = project('document.title = "x";');
    fs.mkdirSync(path.join(root, 'public'));
    fs.writeFileSync(path.join(root, 'public/logo.png'), PNG);
    const { files, warnings } = await buildOnly(root);
    expect([...files.keys()]).toEqual(['build-test.html']);
    expect(warnings).toContainEqual(
      expect.stringContaining(
        '[srgb-effect] files in public are not copied into the single-file effect; import assets from source instead so they get inlined',
      ),
    );
  });

  it('stays quiet about an empty public directory', async () => {
    const root = project('document.title = "x";');
    fs.mkdirSync(path.join(root, 'public/empty'), { recursive: true });
    expect((await buildOnly(root)).warnings).toEqual([]);
  });

  it('keeps build warnings clean', async () => {
    const { warnings } = await buildOnly(project('document.title = "x";'));
    expect(warnings).toEqual([]);
  });
});
