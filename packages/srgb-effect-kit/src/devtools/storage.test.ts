// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createStorage, isRecord, NO_STORAGE } from './storage';

const isNumber = (value: unknown): value is number => typeof value === 'number';

afterEach(() => localStorage.clear());

describe('createStorage', () => {
  it('namespaces keys by effect title', () => {
    const a = createStorage('Effect A', () => localStorage);
    const b = createStorage('Effect B', () => localStorage);
    a.write('speed', 1);
    b.write('speed', 2);
    expect(a.prefix).toBe('srgb-effect-kit:Effect A:');
    expect(localStorage.getItem('srgb-effect-kit:Effect A:speed')).toBe('1');
    expect(a.read('speed', isNumber)).toBe(1);
    expect(b.read('speed', isNumber)).toBe(2);
    a.remove('speed');
    expect(a.read('speed', isNumber)).toBeUndefined();
    expect(b.read('speed', isNumber)).toBe(2);
  });

  it('returns undefined for missing, unparsable or invalid values', () => {
    const storage = createStorage('T', () => localStorage);
    expect(storage.read('missing', isNumber)).toBeUndefined();
    localStorage.setItem('srgb-effect-kit:T:broken', '{not json');
    expect(storage.read('broken', isNumber)).toBeUndefined();
    storage.write('text', 'hello');
    expect(storage.read('text', isNumber)).toBeUndefined();
  });

  it('keeps working when storage is unavailable or throws', () => {
    const throwing = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    for (const getStorage of [
      () => undefined,
      () => throwing,
      () => {
        throw new Error('SecurityError');
      },
    ]) {
      const storage = createStorage('T', getStorage);
      expect(() => storage.write('a', 1)).not.toThrow();
      expect(storage.read('a', isNumber)).toBeUndefined();
      expect(() => storage.remove('a')).not.toThrow();
    }
  });
});

describe('NO_STORAGE', () => {
  it('keeps nothing', () => {
    NO_STORAGE.write('a', 1);
    expect(NO_STORAGE.read('a', isNumber)).toBeUndefined();
    expect(localStorage.length).toBe(0);
  });
});

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
    expect(isRecord('x')).toBe(false);
  });
});
