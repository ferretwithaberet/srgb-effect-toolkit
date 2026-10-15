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

const FORBIDDEN: readonly (readonly [label: string, pattern: RegExp])[] = [
  ['<title>', /<title[\s>]/i],
  ['<meta property>', /<meta\b[^>]*\sproperty\s*=/i],
  ['<meta meter>', /<meta\b[^>]*\smeter\s*=/i],
  ['<meta description>', /<meta\b[^>]*\sdescription\s*=/i],
  ['<meta publisher>', /<meta\b[^>]*\spublisher\s*=/i],
];

/** Tags that srgbEffect() generates and therefore must not be hand-written in index.html. */
export function findForbiddenHeadTags(html: string): string[] {
  const source = html.replace(COMMENT, '');
  return FORBIDDEN.filter(([, pattern]) => pattern.test(source)).map(([label]) => label);
}
