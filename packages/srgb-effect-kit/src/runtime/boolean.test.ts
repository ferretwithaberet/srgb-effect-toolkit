import { describe, expect, it } from 'vitest';
import { parseBoolean } from './boolean';

describe('parseBoolean', () => {
  it.each([
    ['1', true],
    ['0', false],
    [1, true],
    [0, false],
    [true, true],
    [false, false],
    ['true', true],
    ['false', false],
    ['', false],
  ] as const)('%j → %s', (input, expected) => {
    expect(parseBoolean(input)).toBe(expected);
  });
});
