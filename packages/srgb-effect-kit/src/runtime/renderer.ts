/** SignalRGB's two renderers, or `'browser'` for anything else (e.g. `vite dev`). */
export type Renderer = 'ultralight' | 'qtwebengine' | 'browser';

/** User-agent signatures per SignalRGB renderer. Provisional until the probe confirms them. */
export const RENDERER_SIGNATURES: readonly (readonly [Exclude<Renderer, 'browser'>, RegExp])[] = [
  ['ultralight', /\bUltralight\//i],
  ['qtwebengine', /\bQtWebEngine\//i],
];

/**
 * Identifies the renderer from a user agent by matching {@link RENDERER_SIGNATURES}.
 *
 * @param userAgent - Defaults to `navigator.userAgent`, or `''` when there is no navigator.
 */
export const detectRenderer = (
  userAgent: string = globalThis.navigator?.userAgent ?? '',
): Renderer =>
  RENDERER_SIGNATURES.find(([, signature]) => signature.test(userAgent))?.[0] ?? 'browser';

/** Whether the user agent belongs to a SignalRGB renderer. Defaults to `navigator.userAgent`. */
export const isSignalRGB = (userAgent?: string): boolean => detectRenderer(userAgent) !== 'browser';
