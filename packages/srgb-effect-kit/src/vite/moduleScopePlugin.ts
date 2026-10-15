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
  id?: { type?: string; name?: string } | null;
  declaration?: Node | null;
  declarations?: Node[];
}

/** Names a top-level statement binds at module scope (functions and simple variable declarators). */
const declaredNames = (statement: Node): (string | undefined)[] => {
  const declaration =
    statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
      ? statement.declaration
      : statement;
  if (declaration?.type === 'FunctionDeclaration') return [declaration.id?.name];
  if (declaration?.type === 'VariableDeclaration') {
    return (declaration.declarations ?? []).map((declarator) =>
      declarator.id?.type === 'Identifier' ? declarator.id.name : undefined,
    );
  }
  return [];
};

/**
 * Handler names declared at module scope (`function`, `const`, `let`, `var`, plain or exported).
 * Module bindings are not globals, so SignalRGB can never call them.
 */
export function findModuleScopedHandlers(
  code: string,
  fileName: string,
  names: ReadonlySet<string>,
): string[] {
  const result = parseSync(fileName, code, { lang: langFor(fileName), sourceType: 'module' });
  if (result.errors.length > 0) return [];
  const found: string[] = [];
  for (const statement of result.program.body as unknown as Node[]) {
    for (const name of declaredNames(statement)) {
      if (name !== undefined && names.has(name)) found.push(name);
    }
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
          `[srgb-effect] ${path.relative(root, file)}: "${name}" is declared at module scope and will never be called by SignalRGB. Assign it instead: window.${name} = …`,
        );
      }
      return null;
    },
  };
}
