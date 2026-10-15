import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeFileIfChanged } from './fs';

describe('writeFileIfChanged', () => {
  it('creates directories, writes once and skips identical content', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'srgb-fs-'));
    const file = path.join(dir, 'nested', 'a.d.ts');
    expect(writeFileIfChanged(file, 'one')).toBe(true);
    const { mtimeMs } = fs.statSync(file);
    expect(writeFileIfChanged(file, 'one')).toBe(false);
    expect(fs.statSync(file).mtimeMs).toBe(mtimeMs);
    expect(writeFileIfChanged(file, 'two')).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe('two');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
