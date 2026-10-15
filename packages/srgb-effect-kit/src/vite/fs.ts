import fs from 'node:fs';
import path from 'node:path';

/** Writes only when content differs, so watchers don't loop on unchanged output. Returns whether it wrote. */
export function writeFileIfChanged(file: string, content: string): boolean {
  try {
    if (fs.readFileSync(file, 'utf8') === content) return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}
