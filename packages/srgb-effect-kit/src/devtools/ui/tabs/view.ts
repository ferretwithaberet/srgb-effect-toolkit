import type { DevtoolsContext } from '../../context';
import { h } from '../dom';
import type { TabDefinition, TabInstance } from '../drawer';
import { VISIBLE_HEIGHT, VISIBLE_WIDTH } from '../overlay';

/** A crop of a drawable source, in its own pixels. */
export interface SourceRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** The first page canvas whose box covers the whole visible 320×200 area, if any. */
export function findCoveringCanvas(doc: Document): HTMLCanvasElement | undefined {
  return [...doc.querySelectorAll('canvas')].find((canvas) => {
    const rect = canvas.getBoundingClientRect();
    return (
      rect.left <= 0 &&
      rect.top <= 0 &&
      rect.right >= VISIBLE_WIDTH &&
      rect.bottom >= VISIBLE_HEIGHT
    );
  });
}

/** The visible area in a canvas's pixels, given its CSS box (canvases may be scaled by CSS). */
export function canvasSourceRect(
  canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): SourceRect {
  const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
  const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
  return {
    sx: (0 - rect.left) * scaleX,
    sy: (0 - rect.top) * scaleY,
    sw: VISIBLE_WIDTH * scaleX,
    sh: VISIBLE_HEIGHT * scaleY,
  };
}

/** The visible area in a tab capture's pixels: the video maps the viewport. */
export const captureSourceRect = (
  videoWidth: number,
  videoHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): SourceRect => ({
  sx: 0,
  sy: 0,
  sw: (VISIBLE_WIDTH * videoWidth) / viewportWidth,
  sh: (VISIBLE_HEIGHT * videoHeight) / viewportHeight,
});

/** A live tab capture. */
export interface TabCapture {
  readonly video: HTMLVideoElement;
  stop(): void;
}

/** Opens a tab capture; `openTabCapture` in browsers, a fake in tests. */
export type OpenTabCapture = (onEnded: () => void) => Promise<TabCapture>;

/**
 * Captures the current tab with `getDisplayMedia`. `onEnded` runs (once) when the user stops
 * sharing. Every track is released if setup fails, and `stop()` removes the listeners.
 */
export async function openTabCapture(
  onEnded: () => void,
  media: MediaDevices | undefined = navigator.mediaDevices,
): Promise<TabCapture> {
  if (typeof media?.getDisplayMedia !== 'function') {
    throw new Error('[srgb-effect] tab capture needs a secure context (https or localhost)');
  }
  const stream = await media.getDisplayMedia({
    video: true,
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);
  const tracks = stream.getTracks();
  let video: HTMLVideoElement | undefined;
  let endedOnce = false;
  const ended = () => {
    if (endedOnce) return;
    endedOnce = true;
    onEnded();
  };
  const release = () => {
    for (const track of tracks) track.removeEventListener('ended', ended);
    for (const track of tracks) track.stop();
    if (video) video.srcObject = null;
  };
  try {
    if (stream.getVideoTracks().length === 0) throw new Error('[srgb-effect] No video was shared.');
    for (const track of tracks) track.addEventListener('ended', ended);
    video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();
    return { video, stop: release };
  } catch (reason) {
    release();
    throw reason;
  }
}

const messageOf = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason));

/**
 * The SignalRGB view tab: a pixelated, 2x copy of the visible 320x200 area, redrawn at the FPS
 * setting while shown. It samples the covering canvas directly; without one, "Capture this tab"
 * starts an opt-in tab capture (getDisplayMedia with preferCurrentTab) that stops when the tab is
 * hidden and is never restored. WebGL canvases need `preserveDrawingBuffer: true` to be sampled
 * directly. Sampling runs on the native rAF with its own timing, so the simulated rAF throttle
 * doesn't affect it.
 */
export function createViewTab(
  { win, renderer, raf }: DevtoolsContext,
  openCapture: OpenTabCapture = openTabCapture,
): TabInstance {
  const view = h('canvas', {
    class: 'preview',
    width: VISIBLE_WIDTH,
    height: VISIBLE_HEIGHT,
    style: `width:${VISIBLE_WIDTH * 2}px`,
    'data-srgb-devtools': 'view-canvas',
  });
  const status = h('p', { class: 'note', 'data-srgb-devtools': 'view-source' });
  const captureButton = h(
    'button',
    { type: 'button', class: 'button', 'data-srgb-devtools': 'view-capture' },
    'Capture this tab',
  );
  let capture: TabCapture | undefined;
  let pending = false;
  let generation = 0;
  let frameId: number | undefined;
  let last: number | undefined;
  let note: string | undefined;

  const stopCapture = () => {
    const stopping = capture;
    capture = undefined;
    stopping?.stop();
  };
  /** Drops the capture (or an in-flight request for one) and shows `reason`, if any. */
  const drop = (reason?: string) => {
    generation += 1;
    pending = false;
    stopCapture();
    note = reason;
  };

  captureButton.addEventListener('click', async () => {
    if (pending || capture) return;
    const current = (generation += 1);
    pending = true;
    note = undefined;
    captureButton.disabled = true;
    try {
      const opened = await openCapture(() => {
        if (current === generation) drop('Tab capture ended.');
      });
      if (current !== generation) {
        opened.stop();
        return;
      }
      capture = opened;
      pending = false;
    } catch (error) {
      if (current !== generation) return;
      drop(`Tab capture failed: ${messageOf(error)}`);
    } finally {
      captureButton.disabled = pending;
    }
  });

  const draw = () => {
    const ctx = view.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const canvas = findCoveringCanvas(win.document);
    captureButton.hidden = canvas !== undefined || capture !== undefined;
    try {
      if (canvas) {
        const { sx, sy, sw, sh } = canvasSourceRect(canvas, canvas.getBoundingClientRect());
        ctx.clearRect(0, 0, VISIBLE_WIDTH, VISIBLE_HEIGHT);
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, VISIBLE_WIDTH, VISIBLE_HEIGHT);
        status.textContent = 'Sampling the canvas that covers the visible area.';
      } else if (capture) {
        const { video } = capture;
        if (video.videoWidth > 0) {
          const { sx, sy, sw, sh } = captureSourceRect(
            video.videoWidth,
            video.videoHeight,
            win.innerWidth,
            win.innerHeight,
          );
          ctx.drawImage(video, sx, sy, sw, sh, 0, 0, VISIBLE_WIDTH, VISIBLE_HEIGHT);
        }
        status.textContent = 'Sampling the tab capture.';
      } else {
        status.textContent =
          note ?? 'No canvas covers the visible area. Capture this tab to preview it.';
      }
    } catch (error) {
      // A canvas that can't be drawn, or a capture that stopped delivering frames.
      if (capture) {
        drop(`Tab capture failed: ${messageOf(error)}`);
        status.textContent = note ?? '';
      } else {
        status.textContent = `Could not sample the canvas: ${messageOf(error)}`;
      }
      captureButton.hidden = canvas !== undefined || capture !== undefined;
    }
  };
  const loop = (timestamp: number) => {
    frameId = raf.request(loop);
    if (last !== undefined && timestamp - last < 1000 / renderer.settings.fps - 1) return;
    last = timestamp;
    draw();
  };

  const element = h(
    'div',
    { 'data-srgb-devtools': 'view' },
    view,
    status,
    h('div', { class: 'actions' }, captureButton),
  );
  return {
    element,
    show() {
      if (frameId === undefined) frameId = raf.request(loop);
    },
    hide() {
      if (frameId !== undefined) raf.cancel(frameId);
      frameId = undefined;
      last = undefined;
      drop();
      captureButton.disabled = false;
    },
  };
}

export const viewTab: TabDefinition = {
  id: 'view',
  label: 'SignalRGB view',
  create: (context) => createViewTab(context),
};
