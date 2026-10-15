import { detectRenderer } from 'srgb-effect-kit';
import { attempt } from '../log';

// Every field is read on its own, so one throwing getter cannot lose the others.

/** Viewport and document state: the `env` fields that can change after load. */
export const collectViewport = () => ({
  innerWidth: attempt(() => innerWidth),
  innerHeight: attempt(() => innerHeight),
  outerWidth: attempt(() => outerWidth),
  outerHeight: attempt(() => outerHeight),
  devicePixelRatio: attempt(() => devicePixelRatio),
  screen: attempt(() => ({ width: screen.width, height: screen.height })),
  visibilityState: attempt(() => document.visibilityState),
  hasFocus: attempt(() => document.hasFocus()),
  canvas: attempt(() => {
    const canvas = document.querySelector('canvas');
    return canvas
      ? {
          clientWidth: canvas.clientWidth,
          clientHeight: canvas.clientHeight,
          width: canvas.width,
          height: canvas.height,
        }
      : null;
  }),
});

/** User agent, viewport and document state. */
export const collectEnv = () => ({
  userAgent: attempt(() => navigator.userAgent),
  platform: attempt(() => navigator.platform),
  language: attempt(() => navigator.language),
  hardwareConcurrency: attempt(() => navigator.hardwareConcurrency),
  compatMode: attempt(() => document.compatMode),
  detectRenderer: attempt(() => detectRenderer()),
  ...collectViewport(),
});
