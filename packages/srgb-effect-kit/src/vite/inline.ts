export interface ResolvedAsset {
  fileName: string;
  content: string;
}

export interface InlineResult {
  /** HTML with script tags removed and stylesheets inlined. */
  html: string;
  /** Code of the removed scripts, in document order. */
  scripts: string[];
  /** Bundle file names that were inlined. */
  inlined: Set<string>;
  /** URLs that could not be resolved from the bundle and were left in place. */
  external: string[];
}

const SCRIPT_SRC = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>\s*/gi;
const STYLESHEET = /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi;
const HREF = /\bhref=["']([^"']+)["']/i;

const escapeClosing = (code: string, tag: 'script' | 'style') =>
  code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');

export function inlineAssets(
  html: string,
  resolve: (url: string) => ResolvedAsset | undefined,
): InlineResult {
  const scripts: string[] = [];
  const inlined = new Set<string>();
  const external: string[] = [];

  let out = html.replace(SCRIPT_SRC, (tag: string, url: string) => {
    const asset = resolve(url);
    if (!asset) {
      external.push(url);
      return tag;
    }
    inlined.add(asset.fileName);
    scripts.push(asset.content);
    return '';
  });

  out = out.replace(STYLESHEET, (tag: string) => {
    const url = HREF.exec(tag)?.[1];
    const asset = url === undefined ? undefined : resolve(url);
    if (!asset) {
      if (url !== undefined) external.push(url);
      return tag;
    }
    inlined.add(asset.fileName);
    return `<style>${escapeClosing(asset.content, 'style')}</style>`;
  });

  return { html: out, scripts, inlined, external };
}

export const scriptTag = (code: string, kind: 'classic' | 'module'): string =>
  `<script${kind === 'module' ? ' type="module"' : ''}>\n${escapeClosing(code, 'script')}\n</script>`;
