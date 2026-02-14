import { describe, test, expect } from 'bun:test';
import { coerceValue } from '../../src/components/query-builder.js';

describe('coerceValue', () => {
  test('"true" returns boolean true', () => {
    expect(coerceValue('true')).toBe(true);
  });

  test('"false" returns boolean false', () => {
    expect(coerceValue('false')).toBe(false);
  });

  test('integer string returns number', () => {
    expect(coerceValue('42')).toBe(42);
  });

  test('float string returns number', () => {
    expect(coerceValue('3.14')).toBe(3.14);
  });

  test('zero string returns number 0', () => {
    expect(coerceValue('0')).toBe(0);
  });

  test('negative string returns negative number', () => {
    expect(coerceValue('-5')).toBe(-5);
  });

  test('non-numeric string returns string', () => {
    expect(coerceValue('hello')).toBe('hello');
  });

  test('empty string returns empty string', () => {
    expect(coerceValue('')).toBe('');
  });

  test('"NaN" string returns string (not number)', () => {
    expect(coerceValue('NaN')).toBe('NaN');
  });

  test('"Infinity" returns number Infinity', () => {
    expect(coerceValue('Infinity')).toBe(Infinity);
  });
});
