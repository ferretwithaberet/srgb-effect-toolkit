import { detectRenderer } from 'srgb-effect-kit';
import { attempt } from '../log';

/** User agent, viewport and document state. */
export const collectEnv = () => {
  const canvas = document.querySelector('canvas');
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    hardwareConcurrency: navigator.hardwareConcurrency,
    innerWidth,
    innerHeight,
    outerWidth,
    outerHeight,
    devicePixelRatio,
    screen: attempt(() => ({ width: screen.width, height: screen.height })),
    compatMode: document.compatMode,
    visibilityState: document.visibilityState,
    hasFocus: attempt(() => document.hasFocus()),
    canvas: canvas
      ? {
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          width: canvas.width,
          height: canvas.height,
        }
      : null,
    detectRenderer: detectRenderer(),
  };
};
