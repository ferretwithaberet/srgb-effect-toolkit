import { attempt } from '../log';

/** Own property names of `window`, or an empty list when reading them throws. */
const ownNames = (target: object): string[] => {
  try {
    return Object.getOwnPropertyNames(target);
  } catch {
    return [];
  }
};

const typeOf = (name: string): string => {
  const value = attempt(() => (window as unknown as Record<string, unknown>)[name]);
  return value && typeof value === 'object' && 'throws' in value ? 'throws' : typeof value;
};

/** Names a fresh about:blank window has, or null when no iframe window is available. */
function cleanWindowNames(): string[] | null {
  if (!document.body) return null;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText =
    'position:absolute;left:-10px;top:-10px;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  try {
    const clean = frame.contentWindow;
    return clean ? ownNames(clean) : null;
  } finally {
    frame.remove();
  }
}

// Fallback filter: event-handler properties, vendor-prefixed names and built-in constructors.
const looksBuiltIn = (name: string): boolean =>
  /^on[a-z]/.test(name) ||
  /^webkit/i.test(name) ||
  (/^[A-Z]/.test(name) && typeOf(name) === 'function');

/** Names on `window` that a clean window does not have, each with its `typeof`. */
export const collectGlobals = () => {
  let clean: string[] | null = null;
  let iframeError: string | null = null;
  try {
    clean = cleanWindowNames();
  } catch (error) {
    iframeError = error instanceof Error ? error.message : String(error);
  }
  const injected: Record<string, string> = {};
  if (clean && clean.length > 0) {
    const baseline = new Set(clean);
    for (const name of ownNames(window)) if (!baseline.has(name)) injected[name] = typeOf(name);
    return { method: 'iframe', baselineCount: clean.length, injected };
  }
  for (const name of ownNames(window)) if (!looksBuiltIn(name)) injected[name] = typeOf(name);
  return { method: 'fallback', iframeError, injected };
};
