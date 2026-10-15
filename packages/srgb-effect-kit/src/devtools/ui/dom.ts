/** Attribute values: `true` sets an empty attribute; `false`, `null` and `undefined` omit it. */
export type AttrValue = string | number | boolean | null | undefined;
/** Children: strings and numbers become text nodes (never parsed as HTML); falsy ones are skipped. */
export type Child = Node | string | number | null | undefined | false;

/** Creates an element with attributes and children. Manifest strings are always safe as children. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, AttrValue> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    element.setAttribute(name, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === false || child === null || child === undefined) continue;
    element.append(typeof child === 'number' ? String(child) : child);
  }
  return element;
}

/**
 * Coalesces updates to one per animation frame, using the native rAF so the UltraLight simulation
 * doesn't slow the UI down.
 */
export function rafBatch(
  request: (callback: FrameRequestCallback) => number,
  update: () => void,
): () => void {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    request(() => {
      queued = false;
      update();
    });
  };
}
