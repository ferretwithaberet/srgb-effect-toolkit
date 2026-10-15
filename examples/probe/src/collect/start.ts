import { now } from '../state';

/** The first line: when and how the script started. */
export const collectStart = () => {
  const script = document.currentScript;
  return {
    build: import.meta.env.PROBE_BUILD,
    t: now(),
    readyState: document.readyState,
    href: location.href,
    protocol: location.protocol,
    // null for module scripts, the <script> element for classic ones (typeof is 'object' for both).
    currentScript: typeof script,
    currentScriptIsNull: script === null,
    currentScriptType: script ? script.getAttribute('type') : null,
    doctype: document.doctype ? document.doctype.name : null,
  };
};
