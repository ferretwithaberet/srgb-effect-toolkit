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
      // Vite serves `/` from index.html, which does not exist here, so send visitors to the entry.
      server.middlewares.use((req, res, next) => {
        if (req.url === '/' || req.url?.startsWith('/?')) {
          res.statusCode = 302;
          res.setHeader('Location', entry);
          res.end();
          return;
        }
        next();
      });
      const printUrls = server.printUrls.bind(server);
      server.printUrls = () => {
        const urls = server.resolvedUrls;
        if (urls) {
          const withEntry = (url: string) =>
            url.endsWith(entry) ? url : url.replace(/\/$/, '') + entry;
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
