import { describe, test, expect } from 'bun:test';
import { truncate, formatCell, padCell } from '../../src/components/data-table.js';

describe('truncate', () => {
  test('string shorter than max returns as-is', () => {
    expect(truncate('abc', 10)).toBe('abc');
  });

  test('string equal to max returns as-is', () => {
    expect(truncate('abcde', 5)).toBe('abcde');
  });

  test('string longer than max truncates with ellipsis', () => {
    expect(truncate('abcdef', 5)).toBe('abcd\u2026');
  });

  test('max of 1 returns just ellipsis', () => {
    expect(truncate('abc', 1)).toBe('\u2026');
  });

  test('empty string returns empty', () => {
    expect(truncate('', 5)).toBe('');
  });
});

describe('formatCell', () => {
  test('null returns empty string', () => {
    expect(formatCell(null, 'name')).toBe('');
  });

  test('undefined returns empty string', () => {
    expect(formatCell(undefined, 'name')).toBe('');
  });

  test('timestamp column with number formats as date', () => {
    const ts = 1700000000000;
    const result = formatCell(ts, '__createdtime__');
    // Should be a date string, not the raw number
    expect(result).not.toBe('1700000000000');
    expect(result.length).toBeGreaterThan(0);
  });

  test('__updatedtime__ also formats as date', () => {
    const ts = 1700000000000;
    const result = formatCell(ts, '__updatedtime__');
    expect(result).not.toBe('1700000000000');
  });

  test('non-timestamp column with number returns string', () => {
    expect(formatCell(42, 'age')).toBe('42');
  });

  test('object value returns JSON string', () => {
    expect(formatCell({ a: 1 }, 'data')).toBe('{"a":1}');
  });

  test('array value returns JSON string', () => {
    expect(formatCell([1, 2], 'tags')).toBe('[1,2]');
  });

  test('string value returns as-is', () => {
    expect(formatCell('hello', 'name')).toBe('hello');
  });

  test('boolean value returns string', () => {
    expect(formatCell(true, 'active')).toBe('true');
    expect(formatCell(false, 'active')).toBe('false');
  });
});

describe('padCell', () => {
  test('short string is right-padded', () => {
    expect(padCell('abc', 8)).toBe('abc     ');
    expect(padCell('abc', 8).length).toBe(8);
  });

  test('exact width string has no padding', () => {
    expect(padCell('abcde', 5)).toBe('abcde');
  });

  test('long string is truncated', () => {
    const result = padCell('abcdefghij', 5);
    expect(result).toBe('abcd\u2026');
    expect(result.length).toBe(5);
  });
});
