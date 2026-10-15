import fs from 'node:fs';
import path from 'node:path';
import { createServer, type InlineConfig, type ViteDevServer } from 'vite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { srgbEffect } from '../src/vite';
import { buildFixture, cleanupFixtures, createFixture } from './helpers/fixture';

const options = {
  title: 'Devtools Plugin',
  properties: [{ property: 'speed', type: 'number', label: 'Speed', min: 0, max: 10, default: 5 }],
} as const;

const INDEX =
  '<!doctype html><html><head></head><body><script type="module" src="/main.js"></script></body></html>';

const servers: ViteDevServer[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) await server.close();
  cleanupFixtures();
});

const serve = async (config: InlineConfig = {}, listen = false) => {
  const root = createFixture({ 'index.html': INDEX, 'main.js': 'window.started = true;' });
  const server = await createServer({
    root,
    configFile: false,
    logLevel: 'silent',
    server: listen
      ? { host: '127.0.0.1', port: 0, ws: false }
      : { middlewareMode: true, ws: false },
    plugins: [srgbEffect(options)],
    ...config,
  });
  servers.push(server);
  if (listen) await server.listen();
  const html = await server.transformIndexHtml(
    '/index.html',
    fs.readFileSync(path.join(root, 'index.html'), 'utf8'),
  );
  return { server, html, url: server.resolvedUrls?.local[0] ?? '' };
};

const TAG = '<script type="module" src="/@id/__x00__virtual:srgb-effect/devtools"></script>';

describe('devtools plugin', () => {
  it('injects the devtools module script before the effect script', async () => {
    const { html } = await serve();
    expect(html).toContain(TAG);
    expect(html.indexOf(TAG)).toBeLessThan(html.indexOf('src="/main.js"'));
  });

  it('prefixes the script URL with a custom base', async () => {
    const { html } = await serve({ base: '/sub/' });
    expect(html).toContain('src="/sub/@id/__x00__virtual:srgb-effect/devtools"');
  });

  it('serves a virtual module that starts the devtools with the manifest', async () => {
    const { server } = await serve();
    const result = await server.transformRequest('virtual:srgb-effect/devtools');
    expect(result?.code).toMatch(
      /import \{ startDevtools \} from "\/@fs\/[^"]*\/src\/devtools\/index\.ts"/,
    );
    expect(result?.code).toContain('"title":"Devtools Plugin"');
    expect(result?.code).toContain('"fireChangedOnLoad":true');
  });

  it('passes fireChangedOnLoad: false through', async () => {
    const root = createFixture({ 'index.html': INDEX });
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true, ws: false },
      plugins: [srgbEffect({ ...options, devtools: { fireChangedOnLoad: false } })],
    });
    servers.push(server);
    const result = await server.transformRequest('virtual:srgb-effect/devtools');
    expect(result?.code).toContain('"fireChangedOnLoad":false');
  });

  it('relays POST /canvas/event to the page over the WebSocket', async () => {
    const { server, url } = await serve({}, true);
    const send = vi.spyOn(server.ws, 'send');
    const response = await fetch(new URL('/canvas/event?sender=my%20game&event=hit', url), {
      method: 'POST',
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(send).toHaveBeenCalledWith('srgb-effect:canvas-event', {
      sender: 'my game',
      event: 'hit',
    });

    await fetch(new URL('/canvas/event', url), { method: 'POST' });
    expect(send).toHaveBeenLastCalledWith('srgb-effect:canvas-event', { sender: '', event: '' });
  });

  it('rejects methods other than POST', async () => {
    const { server, url } = await serve({}, true);
    const send = vi.spyOn(server.ws, 'send');
    const get = await fetch(new URL('/canvas/event?sender=a&event=b', url));
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the endpoint at /canvas/event under a custom base', async () => {
    const { server, url } = await serve({ base: '/sub/' }, true);
    const send = vi.spyOn(server.ws, 'send');
    const response = await fetch(new URL('/canvas/event?sender=a&event=b', url), {
      method: 'POST',
    });
    expect(response.status).toBe(204);
    expect(send).toHaveBeenCalledOnce();
  });

  it('loads the small minimal entry in minimal mode', async () => {
    const { server, html } = await serve({
      plugins: [srgbEffect({ ...options, devtools: 'minimal' })],
    });
    expect(html).toContain(TAG);
    const result = await server.transformRequest('virtual:srgb-effect/devtools');
    expect(result?.code).toMatch(/from "\/@fs\/[^"]*\/src\/devtools\/minimal\.ts"/);
    expect(result?.code).toContain('"fireChangedOnLoad":true');
  });

  it("injects nothing with devtools: 'none'", async () => {
    const { server, html, url } = await serve(
      { plugins: [srgbEffect({ ...options, devtools: 'none' })] },
      true,
    );
    expect(html).not.toContain('srgb-effect/devtools');
    expect(html).not.toMatch(/onSpeedChanged|engine/);
    await expect(server.transformRequest('virtual:srgb-effect/devtools')).rejects.toThrow();
    const response = await fetch(new URL('/canvas/event', url), { method: 'POST' });
    expect(response.status).toBe(404);
  });

  it('leaves no devtools code in the build', async () => {
    const root = createFixture({ 'index.html': INDEX, 'main.js': 'window.started = speed;' });
    const { files } = await buildFixture(root, { plugins: [srgbEffect(options)] });
    const html = files.get('devtools-plugin.html') ?? '';
    expect(html).toContain('<title>Devtools Plugin</title>');
    expect(html).not.toMatch(/srgb-effect\/devtools|startDevtools|srgb-effect-kit:/);
  });
});
