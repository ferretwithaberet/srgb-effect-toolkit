import { describe, expect, it } from 'vitest';
import { findForbiddenHeadTags, injectBeforeBodyEnd, injectIntoHead } from './html';

describe('injectIntoHead', () => {
  it('inserts right after the opening head tag', () => {
    expect(
      injectIntoHead('<html><head lang="x"><style></style></head></html>', '<title>T</title>'),
    ).toBe('<html><head lang="x">\n<title>T</title>\n<style></style></head></html>');
  });

  it('creates a head after <html> when missing', () => {
    expect(injectIntoHead('<!doctype html><html><body></body></html>', 'M')).toBe(
      '<!doctype html><html><head>\nM\n</head>\n<body></body></html>',
    );
  });

  it('creates a head after the doctype when there is no html tag', () => {
    expect(injectIntoHead('<!DOCTYPE html>\n<body></body>', 'M')).toBe(
      '<!DOCTYPE html><head>\nM\n</head>\n\n<body></body>',
    );
  });

  it('prepends a head when there is nothing to anchor to', () => {
    expect(injectIntoHead('<body></body>', 'M')).toBe('<head>\nM\n</head>\n<body></body>');
  });

  it('does not match tags that merely start with "head"', () => {
    expect(injectIntoHead('<header></header>', 'M')).toBe('<head>\nM\n</head>\n<header></header>');
  });
});

describe('injectBeforeBodyEnd', () => {
  it('inserts before the last closing body tag', () => {
    expect(injectBeforeBodyEnd('<body><p></p></body>', '<script></script>')).toBe(
      '<body><p></p>\n<script></script>\n</body>',
    );
  });

  it('appends when there is no closing body tag', () => {
    expect(injectBeforeBodyEnd('<canvas></canvas>', 'S')).toBe('<canvas></canvas>\nS\n');
  });
});

describe('findForbiddenHeadTags', () => {
  it('finds title and SignalRGB meta tags', () => {
    expect(
      findForbiddenHeadTags(
        '<head><title>x</title><meta property="a" type="number"><meta publisher="me"/></head>',
      ),
    ).toEqual(['<title>', '<meta property>', '<meta publisher>']);
    expect(findForbiddenHeadTags('<meta meter="m" type="area">')).toEqual(['<meta meter>']);
    expect(findForbiddenHeadTags('<meta description="d">')).toEqual(['<meta description>']);
  });

  it('ignores commented-out tags and ordinary meta', () => {
    expect(
      findForbiddenHeadTags(
        '<!-- <title>x</title> <meta property="a"> --><meta charset="utf-8"><meta name="viewport" content="x">',
      ),
    ).toEqual([]);
  });

  it('ignores titles and meta-like text inside svg, script, template and style', () => {
    expect(
      findForbiddenHeadTags(
        [
          '<body><SVG viewBox="0 0 1 1"><title>Logo</title></SVG>',
          '<script>const t = "<title>x</title><meta property=\'a\'>";</script>',
          '<template><title>t</title><meta meter="m"></template>',
          '<style>/* <title> */</style>',
          '<svg><title>a</title></svg><p>text</p><svg><title>b</title></svg></body>',
        ].join(''),
      ),
    ).toEqual([]);
  });

  it('still finds forbidden tags outside and between ignored blocks', () => {
    expect(findForbiddenHeadTags('<svg><title>a</title></svg><title>real</title>')).toEqual([
      '<title>',
    ]);
    expect(findForbiddenHeadTags('<script></script><meta publisher="x"><style></style>')).toEqual([
      '<meta publisher>',
    ]);
  });

  it('explains Open Graph style meta property tags', () => {
    const og = '<meta property> (Open Graph style meta tags collide with SignalRGB controls)';
    expect(findForbiddenHeadTags('<meta property="og:title" content="x">')).toEqual([og]);
    expect(findForbiddenHeadTags("<meta content='x' property='twitter:card'>")).toEqual([og]);
    expect(findForbiddenHeadTags('<meta property=og:image content="x">')).toEqual([og]);
    expect(findForbiddenHeadTags('<meta property="speed" type="number">')).toEqual([
      '<meta property>',
    ]);
  });
});
