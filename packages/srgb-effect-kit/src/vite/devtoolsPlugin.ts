import { normalizePath, type Connect, type Plugin } from 'vite';
import {
  CANVAS_EVENT,
  CANVAS_EVENT_PATH,
  DEVTOOLS_MODULE_ID,
  type DevtoolsConfig,
  type EffectManifest,
} from '../shared';
import { resolveDevtoolsEntry, type DevtoolsEntryMode } from './devtoolsEntry';

const RESOLVED_ID = `\0${DEVTOOLS_MODULE_ID}`;

/**
 * Root-relative URL of the virtual module. Vite prefixes `base` when it processes the injected
 * tag, so the URL must not include it.
 */
export const DEVTOOLS_MODULE_URL = `/@id/__x00__${DEVTOOLS_MODULE_ID}`;

/** Source of the virtual module: imports the devtools entry and starts it with the config. */
export function devtoolsModuleCode(entry: string, config: DevtoolsConfig): string {
  return [
    `import { startDevtools } from ${JSON.stringify(normalizePath(entry))};`,
    `startDevtools(${JSON.stringify(config)}, { hot: import.meta.hot });`,
    '',
  ].join('\n');
}

/**
 * Mirrors SignalRGB's `POST /canvas/event?sender=…&event=…` on the dev server. Missing parameters
 * are sent as empty strings. Answers 204 with `Access-Control-Allow-Origin: *`, so pages on other
 * origins can post too (Vite's own CORS middleware runs first and answers preflights), and 405 for
 * other methods. Other paths go to `next()`.
 */
export function canvasEventMiddleware(
  send: (event: { sender: string; event: string }) => void,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== CANVAS_EVENT_PATH) {
      next();
      return;
    }
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      res.end();
      return;
    }
    send({
      sender: url.searchParams.get('sender') ?? '',
      event: url.searchParams.get('event') ?? '',
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.statusCode = 204;
    res.end();
  };
}

/**
 * Serve-only plugin that injects the devtools entry for `mode` before the effect's scripts and
 * relays canvas API events. `entry` overrides the entry module path (tests).
 */
export function devtoolsPlugin(
  manifest: EffectManifest,
  options: { mode: DevtoolsEntryMode; fireChangedOnLoad: boolean },
  entry?: string,
): Plugin {
  const config: DevtoolsConfig = { manifest, fireChangedOnLoad: options.fireChangedOnLoad };
  let resolvedEntry = entry;
  return {
    name: 'srgb-effect:devtools',
    apply: 'serve',
    configResolved() {
      // Fail at startup, not on the first page load, when the bundle is missing.
      resolvedEntry ??= resolveDevtoolsEntry(options.mode);
    },
    resolveId(id) {
      return id === DEVTOOLS_MODULE_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) return undefined;
      return devtoolsModuleCode(resolvedEntry ?? resolveDevtoolsEntry(options.mode), config);
    },
    configureServer(server) {
      // Registered before Vite's own middlewares, so the path matches whatever `base` is.
      server.middlewares.use(canvasEventMiddleware((event) => server.ws.send(CANVAS_EVENT, event)));
    },
    transformIndexHtml: {
      order: 'pre',
      // Module scripts run in document order, so a head-prepended one runs before the effect's.
      handler: () => [
        {
          tag: 'script',
          attrs: { type: 'module', src: DEVTOOLS_MODULE_URL },
          injectTo: 'head-prepend',
        },
      ],
    },
  };
}
