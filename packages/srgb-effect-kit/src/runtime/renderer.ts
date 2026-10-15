export type Renderer = 'ultralight' | 'qtwebengine' | 'browser';

/** User-agent signatures per SignalRGB renderer. Confirmed by the probe effect. */
export const RENDERER_SIGNATURES: readonly (readonly [Exclude<Renderer, 'browser'>, RegExp])[] = [
  ['ultralight', /\bUltralight\//i],
  ['qtwebengine', /\bQtWebEngine\//i],
];

export const detectRenderer = (
  userAgent: string = globalThis.navigator?.userAgent ?? '',
): Renderer =>
  RENDERER_SIGNATURES.find(([, signature]) => signature.test(userAgent))?.[0] ?? 'browser';

export const isSignalRGB = (userAgent?: string): boolean => detectRenderer(userAgent) !== 'browser';
