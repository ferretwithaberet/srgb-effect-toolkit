import type { SRGBBoolean } from './types';

/** Normalizes a SignalRGB boolean property, tolerating every plausible raw form. */
export const parseBoolean = (value: SRGBBoolean | boolean | number | string): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== '0' && normalized !== 'false';
};
