import type { SRGBBoolean } from './globals';

/**
 * Normalizes a SignalRGB boolean property, tolerating every plausible raw form. Numbers are true
 * unless 0; strings are trimmed and lowercased, then false only for `''`, `'0'` and `'false'`.
 * @example parseBoolean(rainbow) // rainbow: SRGBBoolean
 */
export const parseBoolean = (value: SRGBBoolean | boolean | number | string): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
};
