import path from 'node:path';
import { parseSync, type Plugin } from 'vite';
import { handlerName } from '../shared';
import type { ResolvedOptions } from './options';

const SCRIPT_FILE = /\.(?:[cm]?[jt]sx?)$/;

const langFor = (fileName: string): 'js' | 'jsx' | 'ts' | 'tsx' => {
  if (fileName.endsWith('.tsx')) return 'tsx';
  if (fileName.endsWith('.jsx')) return 'jsx';
  return /\.[cm]?ts$/.test(fileName) ? 'ts' : 'js';
};

interface Node {
  type: string;
  id?: { name?: string } | null;
  declaration?: Node | null;
}

/** Names of top-level `function <handler>() {}` declarations, which SignalRGB can never call from a module. */
export function findModuleScopedHandlers(
  code: string,
  fileName: string,
  names: ReadonlySet<string>,
): string[] {
  const result = parseSync(fileName, code, { lang: langFor(fileName), sourceType: 'module' });
  if (result.errors.length > 0) return [];
  const found: string[] = [];
  for (const statement of result.program.body as unknown as Node[]) {
    const declaration =
      statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    const name = declaration?.type === 'FunctionDeclaration' ? declaration.id?.name : undefined;
    if (name !== undefined && names.has(name)) found.push(name);
  }
  return found;
}

export function moduleScopePlugin(options: ResolvedOptions): Plugin {
  const names = new Set([
    ...(options.manifest.properties ?? []).map((p) => handlerName(p.property)),
    'onCanvasApiEvent',
  ]);
  let root = process.cwd();

  return {
    name: 'srgb-effect:module-scope-check',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      const file = id.split('?')[0]!;
      if (id.startsWith('\0') || file.includes('/node_modules/') || !SCRIPT_FILE.test(file)) {
        return null;
      }
      for (const name of findModuleScopedHandlers(code, file, names)) {
        this.warn(
          `[srgb-effect] ${path.relative(root, file)}: "function ${name}()" is module-scoped and will never be called by SignalRGB. Assign it instead: window.${name} = () => { … }`,
        );
      }
      return null;
    },
  };
}
