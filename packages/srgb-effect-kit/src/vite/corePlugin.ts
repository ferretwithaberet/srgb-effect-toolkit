import path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';
import { findForbiddenHeadTags, generateTypes, injectIntoHead, serializeHead } from '../shared';
import { writeFileIfChanged } from './fs';
import type { ResolvedOptions } from './options';

/** URL path of the single HTML entry when it is not `index.html`, otherwise undefined. */
function customEntryPath(config: ResolvedConfig): string | undefined {
  const build = config.build as {
    rolldownOptions?: { input?: unknown };
    rollupOptions?: { input?: unknown };
  };
  const input = build.rolldownOptions?.input ?? build.rollupOptions?.input;
  const inputs =
    typeof input === 'string'
      ? [input]
      : Array.isArray(input)
        ? input
        : input && typeof input === 'object'
          ? Object.values(input)
          : [];
  const [entry] = inputs;
  if (inputs.length !== 1 || typeof entry !== 'string' || !entry.endsWith('.html'))
    return undefined;
  const relative = path.relative(config.root, path.resolve(config.root, entry));
  if (relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
  const urlPath = `/${relative.split(path.sep).join('/')}`;
  return urlPath === '/index.html' ? undefined : urlPath;
}

export function corePlugin(options: ResolvedOptions): Plugin {
  let command: 'serve' | 'build' = 'serve';
  let root = process.cwd();

  return {
    name: 'srgb-effect:core',
    configResolved(config) {
      command = config.command;
      root = config.root;
      writeFileIfChanged(
        path.resolve(config.root, options.typesFile),
        generateTypes(options.manifest),
      );
    },
    configureServer(server) {
      const entry = customEntryPath(server.config);
      if (!entry) return;
      const base = `/${server.config.base.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\/$/, '/');
      const target = base + entry.slice(1);
      // Vite serves the base from index.html, which does not exist here, so send visitors to the
      // entry. Only the base itself is redirected: with a non-root base, a request for `/` is left
      // to Vite, which already points it at the base.
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '';
        if (url === base || url.startsWith(`${base}?`)) {
          res.statusCode = 302;
          res.setHeader('Location', target + url.slice(base.length));
          res.end();
          return;
        }
        next();
      });
      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        const urls = server.resolvedUrls;
        if (urls) {
          // Vite's printed URLs already end with the base, so only the entry name is appended.
          const withEntry = (url: string) =>
            url.endsWith(entry) ? url : url.replace(/\/?$/, '/') + entry.slice(1);
          urls.local = urls.local.map(withEntry);
          urls.network = urls.network.map(withEntry);
        }
        printUrls();
      };
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const forbidden = findForbiddenHeadTags(html);
        if (forbidden.length > 0) {
          const entry = path.relative(root, ctx.filename).split(path.sep).join('/');
          throw new Error(
            `[srgb-effect] ${entry} must not contain ${forbidden.join(', ')}: these are generated from the srgbEffect() options.`,
          );
        }
        // In builds the head is injected as the final string pass (buildPlugin), after inlining.
        return command === 'serve' ? injectIntoHead(html, serializeHead(options.manifest)) : html;
      },
    },
  };
}
