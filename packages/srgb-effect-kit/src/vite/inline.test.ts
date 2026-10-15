import { describe, expect, it } from 'vitest';
import { inlineAssets, scriptTag } from './inline';

const files: Record<string, string> = {
  'assets/index.js': 'console.log("</script>")',
  'assets/style.css': 'body{content:"</style>"}',
};
const resolve = (url: string) => {
  const fileName = url.replace(/^\.?\//, '');
  return fileName in files ? { fileName, content: files[fileName]! } : undefined;
};

describe('inlineAssets', () => {
  it('removes script tags, collecting code, and inlines stylesheets in place', () => {
    const result = inlineAssets(
      '<head><script type="module" crossorigin src="/assets/index.js"></script>\n<link rel="stylesheet" crossorigin href="./assets/style.css"></head>',
      resolve,
    );
    // The script tag and its trailing whitespace are removed; the stylesheet is inlined in place.
    expect(result.html).toBe('<head><style>body{content:"<\\/style>"}</style></head>');
    expect(result.scripts).toEqual(['console.log("</script>")']);
    expect([...result.inlined].sort()).toEqual(['assets/index.js', 'assets/style.css']);
    expect(result.external).toEqual([]);
  });

  it('leaves unresolvable URLs untouched and reports them', () => {
    const html =
      '<script src="https://cdn.example/x.js"></script><link rel="stylesheet" href="https://cdn.example/x.css">';
    const result = inlineAssets(html, resolve);
    expect(result.html).toBe(html);
    expect(result.external).toEqual(['https://cdn.example/x.js', 'https://cdn.example/x.css']);
  });
});

describe('scriptTag', () => {
  it('escapes closing script tags in code', () => {
    expect(scriptTag('a("</script>")', 'classic')).toBe('<script>\na("<\\/script>")\n</script>');
    expect(scriptTag('a()', 'module')).toBe('<script type="module">\na()\n</script>');
  });
});
