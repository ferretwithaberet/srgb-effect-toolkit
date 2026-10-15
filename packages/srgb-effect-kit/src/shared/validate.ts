import { handlerName } from './names';
import { RESERVED_GLOBALS } from './reservedGlobals.generated';
import type { EffectManifest, HslRanges, MeterDef, PropertyDef, Range } from './types';

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const RESERVED_WORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'let',
  'static',
  'implements',
  'interface',
  'package',
  'private',
  'protected',
  'public',
  'await',
]);
const isIdentifier = (name: string): boolean => IDENTIFIER.test(name) && !RESERVED_WORDS.has(name);
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SIZE = /^\d+x\d+$/;
const ASPECT = /^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/;
const SRGB_GLOBALS = new Set(['engine', 'onCanvasApiEvent']);
const EPSILON = 1e-9;

export class ManifestError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`[srgb-effect] Invalid effect manifest:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ManifestError';
    this.issues = issues;
  }
}

export function collectManifestIssues(manifest: EffectManifest): string[] {
  const issues: string[] = [];
  if (!manifest.title.trim()) issues.push('title: must not be empty');
  checkProperties(manifest.properties ?? [], issues);
  checkMeters(manifest.meters ?? [], issues);
  return issues;
}

export function assertValidManifest(manifest: EffectManifest): void {
  const issues = collectManifestIssues(manifest);
  if (issues.length > 0) throw new ManifestError(issues);
}

function checkProperties(properties: readonly PropertyDef[], issues: string[]): void {
  const names = new Set<string>();
  const handlers = new Map<string, string>();

  properties.forEach((p, i) => {
    const at = `properties[${i}] ("${p.property}")`;
    if (!isIdentifier(p.property))
      issues.push(`${at}: property must be a valid JavaScript identifier`);
    if (names.has(p.property)) issues.push(`${at}: duplicate property name`);
    names.add(p.property);
    if (RESERVED_GLOBALS.has(p.property) || SRGB_GLOBALS.has(p.property)) {
      issues.push(
        `${at}: "${p.property}" collides with a built-in global; SignalRGB injects properties as window globals`,
      );
    }
    const handler = handlerName(p.property);
    const owner = handlers.get(handler);
    if (owner !== undefined && owner !== p.property) {
      issues.push(`${at}: change handler ${handler} collides with property "${owner}"`);
    }
    handlers.set(handler, p.property);
    if (!p.label.trim()) issues.push(`${at}: label must not be empty`);

    switch (p.type) {
      case 'number':
        if (![p.min, p.max, p.default].every(Number.isInteger)) {
          issues.push(`${at}: min, max and default must be whole numbers`);
        } else if (!(p.min <= p.default && p.default <= p.max)) {
          issues.push(
            `${at}: must satisfy min ≤ default ≤ max (got ${p.min} ≤ ${p.default} ≤ ${p.max})`,
          );
        }
        break;
      case 'hue': {
        const min = p.min ?? 0;
        const max = p.max ?? 360;
        if (!(min >= 0 && min <= p.default && p.default <= max && max <= 360)) {
          issues.push(
            `${at}: must satisfy 0 ≤ min ≤ default ≤ max ≤ 360 (got ${min}, ${p.default}, ${max})`,
          );
        }
        break;
      }
      case 'boolean':
        if (typeof p.default !== 'boolean') issues.push(`${at}: default must be a boolean`);
        break;
      case 'color':
        if (!HEX_COLOR.test(p.default))
          issues.push(`${at}: default must be a #rrggbb hex color (got "${p.default}")`);
        break;
      case 'textfield':
        if (typeof p.default !== 'string') issues.push(`${at}: default must be a string`);
        break;
      case 'list': {
        if (p.values.length === 0) issues.push(`${at}: values must not be empty`);
        const seen = new Set<string>();
        for (const value of p.values) {
          if (seen.has(value)) issues.push(`${at}: duplicate value "${value}"`);
          seen.add(value);
          if (value.includes(','))
            issues.push(
              `${at}: value "${value}" must not contain commas (SignalRGB separates values with commas)`,
            );
        }
        if (!p.values.includes(p.default))
          issues.push(`${at}: default "${p.default}" is not one of values`);
        break;
      }
    }
  });
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

function checkMeters(meters: readonly MeterDef[], issues: string[]): void {
  const names = new Set<string>();

  meters.forEach((m, i) => {
    const at = `meters[${i}] ("${m.meter}")`;
    if (!isIdentifier(m.meter)) issues.push(`${at}: meter must be a valid JavaScript identifier`);
    if (names.has(m.meter)) issues.push(`${at}: duplicate meter name`);
    names.add(m.meter);

    const width = m.width;
    const height = m.type === 'linear' ? 0 : m.height;
    checkRegion(at, { x: m.x, y: m.y, width, height }, issues);

    if (m.type === 'linear' || m.type === 'area') {
      checkHsl(at, m, issues);
      if (m.hdr) checkHsl(`${at} hdr`, m.hdr, issues);
    }
    if (m.type === 'ocr_textmatch' && !m.string) issues.push(`${at}: string must not be empty`);
    if ((m.type === 'ocr_textmatch' || m.type === 'ocr_numeric') && m.confidence !== undefined) {
      if (!(m.confidence >= 0 && m.confidence <= 100))
        issues.push(`${at}: confidence must be between 0 and 100`);
    }

    m.resolutions?.forEach((r, j) => {
      const rat = `${at} resolutions[${j}]`;
      if ((r.size === undefined) === (r.aspect === undefined)) {
        issues.push(`${rat}: exactly one of size or aspect is required`);
      }
      if (r.size !== undefined && !SIZE.test(r.size)) {
        issues.push(`${rat}: size must look like "1920x1080" (got "${r.size}")`);
      }
      if (r.aspect !== undefined && !ASPECT.test(r.aspect)) {
        issues.push(`${rat}: aspect must look like "16:9" (got "${r.aspect}")`);
      }
      checkRegion(
        rat,
        { x: r.x ?? m.x, y: r.y ?? m.y, width: r.width ?? width, height: r.height ?? height },
        issues,
      );
    });
  });
}

function checkRegion(at: string, region: Region, issues: string[]): void {
  let inBounds = true;
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const value = region[key];
    if (!(Number.isFinite(value) && value >= 0 && value <= 1)) {
      issues.push(`${at}: ${key} must be between 0 and 1 (got ${value})`);
      inBounds = false;
    }
  }
  if (!inBounds) return;
  if (region.x + region.width > 1 + EPSILON) {
    issues.push(`${at}: x + width must be ≤ 1 (meters outside the screen crash SignalRGB)`);
  }
  if (region.y + region.height > 1 + EPSILON) {
    issues.push(`${at}: y + height must be ≤ 1 (meters outside the screen crash SignalRGB)`);
  }
}

function checkHsl(at: string, ranges: HslRanges, issues: string[]): void {
  checkRange(at, 'h', ranges.h, 360, issues);
  checkRange(at, 's', ranges.s, 100, issues);
  checkRange(at, 'l', ranges.l, 100, issues);
}

function checkRange(
  at: string,
  key: string,
  [min, max]: Range,
  limit: number,
  issues: string[],
): void {
  if (!(min >= 0 && min <= max && max <= limit)) {
    issues.push(`${at}: ${key} range must satisfy 0 ≤ min ≤ max ≤ ${limit} (got ${min}-${max})`);
  }
}
