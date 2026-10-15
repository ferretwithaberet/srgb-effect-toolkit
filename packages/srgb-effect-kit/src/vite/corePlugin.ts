import path from 'node:path';
import type { Plugin } from 'vite';
import { findForbiddenHeadTags, generateTypes, injectIntoHead, serializeHead } from '../shared';
import { writeFileIfChanged } from './fs';
import type { ResolvedOptions } from './options';

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
