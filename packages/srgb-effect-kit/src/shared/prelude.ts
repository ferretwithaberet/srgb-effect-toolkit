import { handlerName } from './names';
import type { EffectManifest } from './types';

/**
 * ES5 snippet run before effect code. It makes sure every handler global exists on window,
 * so a bare `onSpeedChanged = …` in strict module code does not throw a ReferenceError.
 */
export function generatePrelude(manifest: EffectManifest): string {
  const names = [
    ...(manifest.properties ?? []).map((p) => handlerName(p.property)),
    'onCanvasApiEvent',
  ];
  return `(function(){var w=window,n=${JSON.stringify(names)};for(var i=0;i<n.length;i++){if(!(n[i] in w))w[n[i]]=undefined;}})();`;
}
