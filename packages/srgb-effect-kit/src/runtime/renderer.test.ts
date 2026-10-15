import { describe, expect, it } from 'vitest';
import { detectRenderer, isSignalRGB } from './renderer';

const ULTRALIGHT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/615.1.18.100.1 (KHTML, like Gecko) Ultralight/1.4.0 Version/16.4.1 Safari/615.1.18.100.1';
const QTWEBENGINE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) QtWebEngine/6.8.2 Chrome/122.0.6261.171 Safari/537.36';
const CHROME =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('detectRenderer', () => {
  it('identifies renderers from the user agent', () => {
    expect(detectRenderer(ULTRALIGHT)).toBe('ultralight');
    expect(detectRenderer(QTWEBENGINE)).toBe('qtwebengine');
    expect(detectRenderer(CHROME)).toBe('browser');
    expect(detectRenderer('')).toBe('browser');
  });

  it('isSignalRGB is true for either SignalRGB renderer', () => {
    expect(isSignalRGB(ULTRALIGHT)).toBe(true);
    expect(isSignalRGB(QTWEBENGINE)).toBe(true);
    expect(isSignalRGB(CHROME)).toBe(false);
  });
});
