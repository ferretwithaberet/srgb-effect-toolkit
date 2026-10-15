import type { EffectManifest, MeterDef, PropertyDef, Range } from './types';

type Attr = readonly [name: string, value: string | number | undefined];

export const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const attrs = (list: readonly Attr[]): string =>
  list
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `${name}="${escapeAttr(String(value))}"`)
    .join(' ');

const range = ([min, max]: Range): string => `${min}-${max}`;

export function serializeProperty(p: PropertyDef): string {
  const list: Attr[] = [
    ['property', p.property],
    ['label', p.label],
    ['type', p.type],
  ];
  switch (p.type) {
    case 'number':
      list.push(['min', p.min], ['max', p.max], ['default', p.default]);
      break;
    case 'hue':
      list.push(['min', p.min ?? 0], ['max', p.max ?? 360], ['default', p.default]);
      break;
    case 'boolean':
      list.push(['default', p.default ? '1' : '0']);
      break;
    case 'color':
      // SignalRGB's docs always pair color pickers with min="0" max="360".
      list.push(['min', 0], ['max', 360], ['default', p.default]);
      break;
    case 'textfield':
      list.push(['default', p.default]);
      break;
    case 'list':
      list.push(['values', p.values.join(',')], ['default', p.default]);
      break;
  }
  list.push(['tooltip', p.tooltip]);
  return `<meta ${attrs(list)} />`;
}

export function serializeMeter(m: MeterDef): string {
  const list: Attr[] = [
    ['meter', m.meter],
    ['type', m.type],
    ['tags', m.tags?.join(',')],
    ['x', m.x],
    ['y', m.y],
    ['width', m.width],
  ];
  if (m.type !== 'linear') list.push(['height', m.height]);
  if (m.type === 'linear' || m.type === 'area') {
    list.push(['h', range(m.h)], ['s', range(m.s)], ['l', range(m.l)]);
    if (m.hdr)
      list.push(['hdr-h', range(m.hdr.h)], ['hdr-s', range(m.hdr.s)], ['hdr-l', range(m.hdr.l)]);
  }
  if (m.type === 'ocr_textmatch') list.push(['string', m.string]);
  if (m.type === 'ocr_textmatch' || m.type === 'ocr_numeric')
    list.push(['confidence', m.confidence ?? 70]);

  const open = `<meta ${attrs(list)}`;
  if (!m.resolutions?.length) return `${open} />`;

  // SignalRGB requires resolution overrides between an explicit <meta> … </meta> pair.
  const children = m.resolutions.map(
    (r) =>
      `  <resolution ${attrs([
        ['size', r.size],
        ['aspect', r.aspect],
        ['x', r.x],
        ['y', r.y],
        ['width', r.width],
        // Linear meters are a single row of pixels; SignalRGB has no height for them.
        ['height', m.type === 'linear' ? undefined : r.height],
      ])} />`,
  );
  return [`${open}>`, ...children, '</meta>'].join('\n');
}

export function serializeHead(manifest: EffectManifest): string {
  const lines = [`<title>${escapeText(manifest.title)}</title>`];
  if (manifest.description !== undefined)
    lines.push(`<meta description="${escapeAttr(manifest.description)}" />`);
  if (manifest.publisher !== undefined)
    lines.push(`<meta publisher="${escapeAttr(manifest.publisher)}" />`);
  for (const p of manifest.properties ?? []) lines.push(serializeProperty(p));
  for (const m of manifest.meters ?? []) lines.push(serializeMeter(m));
  return lines.join('\n');
}
