import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build, createLogger, type InlineConfig, type Rolldown } from 'vite';

const roots: string[] = [];

/** Writes files into a fresh temp directory and returns its path. */
export function createFixture(files: Record<string, string | Uint8Array>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'srgb-effect-'));
  roots.push(root);
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  return root;
}

export function cleanupFixtures(): void {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
}

export interface FixtureBuild {
  /** Output file name → text content. */
  files: Map<string, string>;
  warnings: string[];
}

/** Runs `vite build` in memory (write: false) and collects outputs and warnings. */
export async function buildFixture(root: string, config: InlineConfig = {}): Promise<FixtureBuild> {
  const warnings: string[] = [];
  const logger = createLogger('warn', { allowClearScreen: false });
  logger.warn = (message) => void warnings.push(message);
  logger.warnOnce = (message) => void warnings.push(message);

  const result = await build({
    root,
    configFile: false,
    logLevel: 'warn',
    customLogger: logger,
    ...config,
    build: { write: false, ...config.build },
  });

  const outputs = (Array.isArray(result) ? result : [result]) as Rolldown.RolldownOutput[];
  const files = new Map<string, string>();
  for (const output of outputs) {
    for (const file of output.output) {
      const text =
        file.type === 'chunk'
          ? file.code
          : typeof file.source === 'string'
            ? file.source
            : new TextDecoder().decode(file.source);
      files.set(file.fileName, text);
    }
  }
  return { files, warnings };
}
