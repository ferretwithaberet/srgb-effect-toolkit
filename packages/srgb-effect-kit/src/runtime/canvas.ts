export type CanvasContextType = '2d' | 'webgl' | 'webgl2';

type ContextFor<C extends CanvasContextType> = C extends '2d'
  ? CanvasRenderingContext2D
  : C extends 'webgl'
    ? WebGLRenderingContext
    : WebGL2RenderingContext;

export interface GetCanvasOptions<C extends CanvasContextType> {
  /** Canvas element id. Defaults to the first <canvas> in the document. */
  id?: string;
  /** @default '2d' */
  context?: C;
}

export interface CanvasHandle<C extends CanvasContextType> {
  canvas: HTMLCanvasElement;
  ctx: ContextFor<C>;
}

export function getCanvas<C extends CanvasContextType = '2d'>(
  options: GetCanvasOptions<C> = {},
): CanvasHandle<C> {
  const { id } = options;
  const contextType = options.context ?? '2d';
  const element = id === undefined ? document.querySelector('canvas') : document.getElementById(id);
  if (!(element instanceof HTMLCanvasElement)) {
    throw new Error(
      `[srgb-effect] getCanvas: no ${id === undefined ? '<canvas>' : `<canvas id="${id}">`} element found`,
    );
  }
  const ctx = element.getContext(contextType);
  if (!ctx) throw new Error(`[srgb-effect] getCanvas: "${contextType}" context is not available`);
  return { canvas: element, ctx: ctx as ContextFor<C> };
}
