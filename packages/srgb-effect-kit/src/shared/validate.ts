import { handlerName } from './names';
import { RESERVED_GLOBALS } from './reservedGlobals.generated';
import type { EffectManifest } from './types';

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
const PROPERTY_TYPES = new Set(['number', 'hue', 'boolean', 'color', 'textfield', 'list']);
const METER_TYPES = new Set(['linear', 'area', 'ocr_textmatch', 'ocr_numeric']);

/**
 * Manifests can come from untyped JavaScript configs, so every check reads fields as `unknown`
 * and reports a prefixed issue instead of throwing.
 */
type Loose = Record<string, unknown>;
const isObject = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');
const isRange = (value: unknown): value is readonly [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber);
const show = (value: unknown): string =>
  typeof value === 'string' ? JSON.stringify(value) : String(value);
const label = (base: string, name: unknown): string =>
  typeof name === 'string' ? `${base} ("${name}")` : base;

export class ManifestError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`[srgb-effect] Invalid effect manifest:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ManifestError';
    this.issues = issues;
  }
}

export function collectManifestIssues(manifest: EffectManifest): string[] {
  const loose: unknown = manifest;
  if (!isObject(loose)) return ['manifest: must be an object'];
  const issues: string[] = [];
  if (typeof loose.title !== 'string') issues.push('title: must be a string');
  else if (!loose.title.trim()) issues.push('title: must not be empty');
  for (const key of ['description', 'publisher'] as const) {
    if (loose[key] !== undefined && typeof loose[key] !== 'string')
      issues.push(`${key}: must be a string`);
  }
  for (const key of ['properties', 'meters'] as const) {
    if (loose[key] !== undefined && !Array.isArray(loose[key]))
      issues.push(`${key}: must be an array`);
  }
  if (Array.isArray(loose.properties)) checkProperties(loose.properties, issues);
  if (Array.isArray(loose.meters)) checkMeters(loose.meters, issues);
  return issues;
}

export function assertValidManifest(manifest: EffectManifest): void {
  const issues = collectManifestIssues(manifest);
  if (issues.length > 0) throw new ManifestError(issues);
}

function checkProperties(properties: readonly unknown[], issues: string[]): void {
  const names = new Set<string>();
  const handlers = new Map<string, string>();

  properties.forEach((p, i) => {
    if (!isObject(p)) {
      issues.push(`properties[${i}]: must be an object`);
      return;
    }
    const at = label(`properties[${i}]`, p.property);
    if (typeof p.property !== 'string') {
      issues.push(`${at}: property must be a string`);
    } else {
      checkPropertyName(at, p.property, names, handlers, issues);
    }
    if (typeof p.label !== 'string') issues.push(`${at}: label must be a string`);
    else if (!p.label.trim()) issues.push(`${at}: label must not be empty`);

    if (typeof p.type !== 'string' || !PROPERTY_TYPES.has(p.type)) {
      issues.push(`${at}: unknown type ${show(p.type)}`);
    } else {
      checkPropertyType(at, p, issues);
    }
    if (p.tooltip !== undefined && typeof p.tooltip !== 'string')
      issues.push(`${at}: tooltip must be a string`);
  });
}

function checkPropertyName(
  at: string,
  property: string,
  names: Set<string>,
  handlers: Map<string, string>,
  issues: string[],
): void {
  if (!isIdentifier(property)) issues.push(`${at}: property must be a valid JavaScript identifier`);
  if (names.has(property)) issues.push(`${at}: duplicate property name`);
  names.add(property);
  if (RESERVED_GLOBALS.has(property) || SRGB_GLOBALS.has(property)) {
    issues.push(
      `${at}: "${property}" collides with a built-in global; SignalRGB injects properties as window globals`,
    );
  }
  const handler = handlerName(property);
  const owner = handlers.get(handler);
  if (owner !== undefined && owner !== property) {
    issues.push(`${at}: change handler ${handler} collides with property "${owner}"`);
  }
  handlers.set(handler, property);
}

function checkPropertyType(at: string, p: Loose, issues: string[]): void {
  switch (p.type) {
    case 'number': {
      const { min, max, default: value } = p;
      if (!(Number.isInteger(min) && Number.isInteger(max) && Number.isInteger(value))) {
        issues.push(`${at}: min, max and default must be whole numbers`);
      } else if (!((min as number) <= (value as number) && (value as number) <= (max as number))) {
        issues.push(`${at}: must satisfy min ≤ default ≤ max (got ${min} ≤ ${value} ≤ ${max})`);
      }
      break;
    }
    case 'hue': {
      const { min = 0, max = 360, default: value } = p;
      const numericDefault = isFiniteNumber(value);
      const numericBounds = isFiniteNumber(min) && isFiniteNumber(max);
      if (!numericDefault) issues.push(`${at}: default must be a number`);
      if (!numericBounds) issues.push(`${at}: min and max must be numbers`);
      if (
        numericDefault &&
        numericBounds &&
        !(min >= 0 && min <= value && value <= max && max <= 360)
      ) {
        issues.push(
          `${at}: must satisfy 0 ≤ min ≤ default ≤ max ≤ 360 (got ${min}, ${value}, ${max})`,
        );
      }
      break;
    }
    case 'boolean':
      if (typeof p.default !== 'boolean') issues.push(`${at}: default must be a boolean`);
      break;
    case 'color':
      if (typeof p.default !== 'string' || !HEX_COLOR.test(p.default))
        issues.push(`${at}: default must be a #rrggbb hex color (got "${String(p.default)}")`);
      break;
    case 'textfield':
      if (typeof p.default !== 'string') issues.push(`${at}: default must be a string`);
      break;
    case 'list': {
      const { values, default: value } = p;
      if (!isStringArray(values)) {
        issues.push(`${at}: values must be an array of strings`);
        break;
      }
      if (values.length === 0) issues.push(`${at}: values must not be empty`);
      const seen = new Set<string>();
      for (const item of values) {
        if (seen.has(item)) issues.push(`${at}: duplicate value "${item}"`);
        seen.add(item);
        if (item.includes(','))
          issues.push(
            `${at}: value "${item}" must not contain commas (SignalRGB separates values with commas)`,
          );
      }
      if (typeof value !== 'string') issues.push(`${at}: default must be a string`);
      else if (!values.includes(value))
        issues.push(`${at}: default "${value}" is not one of values`);
      break;
    }
  }
}

interface Region {
  x: unknown;
  y: unknown;
  width: unknown;
  height: unknown;
}

function checkMeters(meters: readonly unknown[], issues: string[]): void {
  const names = new Set<string>();

  meters.forEach((m, i) => {
    if (!isObject(m)) {
      issues.push(`meters[${i}]: must be an object`);
      return;
    }
    const at = label(`meters[${i}]`, m.meter);
    if (typeof m.meter !== 'string') {
      issues.push(`${at}: meter must be a string`);
    } else {
      if (!isIdentifier(m.meter)) issues.push(`${at}: meter must be a valid JavaScript identifier`);
      if (names.has(m.meter)) issues.push(`${at}: duplicate meter name`);
      names.add(m.meter);
    }
    if (typeof m.type !== 'string' || !METER_TYPES.has(m.type)) {
      issues.push(`${at}: unknown type ${show(m.type)}`);
      return;
    }

    const linear = m.type === 'linear';
    const width = m.width;
    const height = linear ? 0 : m.height;
    checkRegion(at, { x: m.x, y: m.y, width, height }, issues);

    if (linear || m.type === 'area') {
      checkHsl(at, m, issues);
      if (m.hdr !== undefined) {
        if (isObject(m.hdr)) checkHsl(`${at} hdr`, m.hdr, issues);
        else issues.push(`${at}: hdr must be an object with h, s and l ranges`);
      }
    }
    if (m.type === 'ocr_textmatch') {
      if (typeof m.string !== 'string') issues.push(`${at}: string must be a string`);
      else if (!m.string) issues.push(`${at}: string must not be empty`);
    }
    if ((m.type === 'ocr_textmatch' || m.type === 'ocr_numeric') && m.confidence !== undefined) {
      if (!(isFiniteNumber(m.confidence) && m.confidence >= 0 && m.confidence <= 100))
        issues.push(`${at}: confidence must be a number between 0 and 100`);
    }

    if (m.tags !== undefined) {
      if (!isStringArray(m.tags)) {
        issues.push(`${at}: tags must be an array of strings`);
      } else {
        for (const tag of m.tags) {
          if (tag.includes(','))
            issues.push(
              `${at}: tag "${tag}" must not contain commas (SignalRGB separates tags with commas)`,
            );
        }
      }
    }

    if (m.resolutions === undefined) return;
    if (!Array.isArray(m.resolutions)) {
      issues.push(`${at}: resolutions must be an array`);
      return;
    }
    m.resolutions.forEach((r: unknown, j) => {
      const rat = `${at} resolutions[${j}]`;
      if (!isObject(r)) {
        issues.push(`${rat}: must be an object`);
        return;
      }
      if ((r.size === undefined) === (r.aspect === undefined)) {
        issues.push(`${rat}: exactly one of size or aspect is required`);
      }
      if (r.size !== undefined && !(typeof r.size === 'string' && SIZE.test(r.size))) {
        issues.push(`${rat}: size must look like "1920x1080" (got ${show(r.size)})`);
      }
      if (r.aspect !== undefined && !(typeof r.aspect === 'string' && ASPECT.test(r.aspect))) {
        issues.push(`${rat}: aspect must look like "16:9" (got ${show(r.aspect)})`);
      }
      if (linear && r.height !== undefined) {
        issues.push(`${rat}: height is not allowed on linear meters`);
      }
      checkRegion(
        rat,
        {
          x: r.x ?? m.x,
          y: r.y ?? m.y,
          width: r.width ?? width,
          height: linear ? 0 : (r.height ?? height),
        },
        issues,
      );
    });
  });
}

function checkRegion(at: string, region: Region, issues: string[]): void {
  let inBounds = true;
  for (const key of ['x', 'y', 'width', 'height'] as const) {
    const value = region[key];
    if (!isFiniteNumber(value)) {
      issues.push(`${at}: ${key} must be a finite number (got ${show(value)})`);
      inBounds = false;
    } else if (!(value >= 0 && value <= 1)) {
      issues.push(`${at}: ${key} must be between 0 and 1 (got ${value})`);
      inBounds = false;
    }
  }
  if (!inBounds) return;
  const { x, y, width, height } = region as Record<keyof Region, number>;
  if (x + width > 1 + EPSILON) {
    issues.push(`${at}: x + width must be ≤ 1 (meters outside the screen crash SignalRGB)`);
  }
  if (y + height > 1 + EPSILON) {
    issues.push(`${at}: y + height must be ≤ 1 (meters outside the screen crash SignalRGB)`);
  }
}

function checkHsl(at: string, ranges: Loose, issues: string[]): void {
  checkRange(at, 'h', ranges.h, 360, issues);
  checkRange(at, 's', ranges.s, 100, issues);
  checkRange(at, 'l', ranges.l, 100, issues);
}

function checkRange(
  at: string,
  key: string,
  range: unknown,
  limit: number,
  issues: string[],
): void {
  if (!isRange(range)) {
    issues.push(`${at}: ${key} must be a [min, max] pair of numbers`);
    return;
  }
  const [min, max] = range;
  if (!(min >= 0 && min <= max && max <= limit)) {
    issues.push(`${at}: ${key} range must satisfy 0 ≤ min ≤ max ≤ ${limit} (got ${min}-${max})`);
  }
}
