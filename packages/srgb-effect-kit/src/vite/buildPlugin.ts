import type { Plugin, Rolldown } from 'vite';
import { generatePrelude, injectBeforeBodyEnd, injectIntoHead, serializeHead } from '../shared';
import { inlineAssets, scriptTag } from './inline';
import type { ResolvedOptions } from './options';

export function buildPlugin(options: ResolvedOptions): Plugin {
  let base = '/';

  return {
    name: 'srgb-effect:build',
    apply: 'build',
    enforce: 'post',

    config() {
      return {
        build: {
          target: options.target,
          assetsInlineLimit: () => true,
          cssCodeSplit: false,
          modulePreload: false,
          copyPublicDir: false,
          rolldownOptions: {
            output: {
              codeSplitting: false,
              ...(options.script === 'classic' ? { format: 'iife' as const } : {}),
              ...(options.dropConsole
                ? { minify: { compress: { dropConsole: true, dropDebugger: true } } }
                : {}),
            },
          },
        },
      };
    },

    configResolved(config) {
      base = config.base;
    },

    onLog(_level, log) {
      if (log.code !== 'EMPTY_IMPORT_META') return;
      // Vite's own helpers (virtual \0 modules) reference import.meta in dead code paths; user code must not.
      if (options.script === 'classic' && log.id && !log.id.startsWith('\0')) {
        this.error(
          `[srgb-effect] ${log.id} uses import.meta, which is unavailable in classic scripts. Remove it (import.meta.env is fine) or set script: 'module'.`,
        );
      }
      return false;
    },

    generateBundle(_outputOptions, bundle) {
      const htmlFiles = Object.values(bundle).filter(
        (file): file is Rolldown.OutputAsset =>
          file.type === 'asset' && file.fileName.endsWith('.html'),
      );
      if (htmlFiles.length !== 1) {
        this.error(`[srgb-effect] expected exactly one HTML entry, found ${htmlFiles.length}`);
      }
      const htmlFile = htmlFiles[0]!;

      const toFileName = (url: string) => {
        let name = url.split(/[?#]/)[0]!;
        if (base !== './' && base !== '' && name.startsWith(base)) name = name.slice(base.length);
        return name.replace(/^\.?\//, '');
      };
      const result = inlineAssets(String(htmlFile.source), (url) => {
        const file = bundle[toFileName(url)];
        if (!file) return undefined;
        return {
          fileName: file.fileName,
          content: file.type === 'chunk' ? file.code : String(file.source),
        };
      });
      for (const url of result.external) {
        this.warn(
          `[srgb-effect] ${url} is not part of the bundle and was left as an external reference`,
        );
      }

      const scripts = [scriptTag(generatePrelude(options.manifest), 'classic')];
      for (const code of result.scripts) scripts.push(scriptTag(code, options.script));
      let html = injectBeforeBodyEnd(result.html, scripts.join('\n'));
      // Final string pass: meters need non-void <meta> … </meta>, which an HTML parser would mangle.
      html = injectIntoHead(html, serializeHead(options.manifest));

      for (const fileName of result.inlined) delete bundle[fileName];
      delete bundle[htmlFile.fileName];
      const leftovers = Object.keys(bundle);
      if (leftovers.length > 0) {
        this.error(
          `[srgb-effect] build produced files that could not be inlined: ${leftovers.join(', ')}`,
        );
      }
      this.emitFile({ type: 'asset', fileName: options.fileName, source: html });
    },
  };
}
