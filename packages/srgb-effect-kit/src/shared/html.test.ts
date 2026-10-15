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
});
