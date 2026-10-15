const HEAD_OPEN = /<head(?:\s[^>]*)?>/i;
const HTML_OPEN = /<html(?:\s[^>]*)?>/i;
const DOCTYPE = /<!doctype[^>]*>/i;
const BODY_CLOSE = /<\/body\s*>/gi;
const COMMENT = /<!--[\s\S]*?-->/g;

const insertAt = (html: string, index: number, markup: string): string =>
  `${html.slice(0, index)}${markup}${html.slice(index)}`;

/** Inserts markup at the start of <head>, creating the element when the document has none. */
export function injectIntoHead(html: string, markup: string): string {
  const head = HEAD_OPEN.exec(html);
  if (head) return insertAt(html, head.index + head[0].length, `\n${markup}\n`);

  const block = `<head>\n${markup}\n</head>\n`;
  const anchor = HTML_OPEN.exec(html) ?? DOCTYPE.exec(html);
  if (anchor) return insertAt(html, anchor.index + anchor[0].length, block);
  return `${block}${html}`;
}

/** Inserts markup before the last </body>, or appends it when the document has none. */
export function injectBeforeBodyEnd(html: string, markup: string): string {
  let last: RegExpExecArray | undefined;
  for (const match of html.matchAll(BODY_CLOSE)) last = match as RegExpExecArray;
  if (!last) return `${html}\n${markup}\n`;
  return insertAt(html, last.index, `\n${markup}\n`);
}

/** Elements whose content may legitimately contain <title> or meta-like text (e.g. inline SVG). */
const IGNORED_BLOCK = /<(svg|script|template|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const META_PROPERTY = /<meta\b[^>]*\sproperty\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
const OPEN_GRAPH_LABEL =
  '<meta property> (Open Graph style meta tags collide with SignalRGB controls)';

const TITLE = /<title[\s>]/i;
const FORBIDDEN_META: readonly (readonly [label: string, pattern: RegExp])[] = [
  ['<meta meter>', /<meta\b[^>]*\smeter\s*=/i],
  ['<meta description>', /<meta\b[^>]*\sdescription\s*=/i],
  ['<meta publisher>', /<meta\b[^>]*\spublisher\s*=/i],
];

/** Tags that srgbEffect() generates and therefore must not be hand-written in index.html. */
export function findForbiddenHeadTags(html: string): string[] {
  const source = html.replace(COMMENT, '').replace(IGNORED_BLOCK, '');
  const found = new Set<string>();
  if (TITLE.test(source)) found.add('<title>');
  // SignalRGB reads every <meta property> as a control, so Open Graph tags (og:title, …) break too.
  for (const match of source.matchAll(META_PROPERTY)) {
    const value = match[1] ?? match[2] ?? match[3] ?? '';
    found.add(value.includes(':') ? OPEN_GRAPH_LABEL : '<meta property>');
  }
  for (const [label, pattern] of FORBIDDEN_META) if (pattern.test(source)) found.add(label);
  return [...found];
}
