import { describe, test, expect } from 'bun:test';
import { renderJson, getLineKeyMap, type RenderedLine } from '../../src/components/json-tree.js';

/** Helper to extract all text from a rendered line */
function lineText(line: RenderedLine): string {
  return line.segments.map((s) => s.text).join('');
}

/** Helper to find a segment with specific color */
function segmentWithColor(line: RenderedLine, color: string) {
  return line.segments.find((s) => s.color === color);
}

describe('renderJson', () => {
  test('null', () => {
    const lines = renderJson(null, 0);
    expect(lines).toHaveLength(1);
    expect(segmentWithColor(lines[0], 'dim')?.text).toBe('null');
  });

  test('string', () => {
    const lines = renderJson('hello', 0);
    expect(lines).toHaveLength(1);
    expect(segmentWithColor(lines[0], 'green')?.text).toBe('"hello"');
  });

  test('number', () => {
    const lines = renderJson(42, 0);
    expect(lines).toHaveLength(1);
    expect(segmentWithColor(lines[0], 'yellow')?.text).toBe('42');
  });

  test('boolean true', () => {
    const lines = renderJson(true, 0);
    expect(lines).toHaveLength(1);
    expect(segmentWithColor(lines[0], 'cyan')?.text).toBe('true');
  });

  test('boolean false', () => {
    const lines = renderJson(false, 0);
    expect(lines).toHaveLength(1);
    expect(segmentWithColor(lines[0], 'cyan')?.text).toBe('false');
  });

  test('empty array', () => {
    const lines = renderJson([], 0);
    expect(lines).toHaveLength(1);
    expect(lineText(lines[0])).toBe('[]');
  });

  test('non-empty array', () => {
    const lines = renderJson([1, 2], 0);
    // [ , 1, , 2 , ]
    expect(lineText(lines[0])).toBe('[');
    expect(lineText(lines[lines.length - 1])).toBe(']');
    // First element has trailing comma
    const firstElem = lineText(lines[1]);
    expect(firstElem).toContain('1');
    expect(firstElem).toContain(',');
    // Last element has no trailing comma
    const lastElem = lineText(lines[2]);
    expect(lastElem).toContain('2');
    expect(lastElem).not.toContain(',');
  });

  test('empty object', () => {
    const lines = renderJson({}, 0);
    expect(lines).toHaveLength(1);
    expect(lineText(lines[0])).toBe('{}');
  });

  test('simple object', () => {
    const lines = renderJson({ name: 'test' }, 0);
    // { , "name": "test" , }
    expect(lineText(lines[0])).toBe('{');
    expect(lineText(lines[lines.length - 1])).toBe('}');

    // Key line contains key and value
    const keyLine = lines[1];
    expect(segmentWithColor(keyLine, 'bold')?.text).toBe('"name"');
    expect(segmentWithColor(keyLine, 'green')?.text).toBe('"test"');
  });

  test('indentation is applied', () => {
    const lines = renderJson('test', 4);
    expect(lines[0].segments[0].text).toBe('    ');
  });

  test('nested object indentation', () => {
    const lines = renderJson({ a: { b: 1 } }, 0);
    // { , "a": { , "b": 1 , } , }
    expect(lines.length).toBeGreaterThanOrEqual(5);
    // Inner key "b" should be indented by 4 spaces (2 + 2)
    const bLine = lines.find((l) => segmentWithColor(l, 'bold')?.text === '"b"');
    expect(bLine).toBeDefined();
    expect(bLine!.segments[0].text).toBe('    '); // 4 spaces
  });

  test('trackKeys sets topLevelKey for object keys', () => {
    const lines = renderJson({ id: 1, name: 'test' }, 0, true);
    const idLine = lines.find((l) => l.topLevelKey === 'id');
    const nameLine = lines.find((l) => l.topLevelKey === 'name');
    expect(idLine).toBeDefined();
    expect(nameLine).toBeDefined();
  });

  test('trackKeys does not set topLevelKey on nested keys', () => {
    const lines = renderJson({ outer: { inner: 1 } }, 0, true);
    const innerLine = lines.find((l) => l.topLevelKey === 'inner');
    expect(innerLine).toBeUndefined();
    const outerLine = lines.find((l) => l.topLevelKey === 'outer');
    expect(outerLine).toBeDefined();
  });

  test('commas between object keys', () => {
    const lines = renderJson({ a: 1, b: 2 }, 0);
    // "a": 1, line should have comma
    const aLine = lines.find((l) => segmentWithColor(l, 'bold')?.text === '"a"');
    expect(lineText(aLine!)).toContain(',');
    // "b": 2 line should NOT have comma
    const bLine = lines.find((l) => segmentWithColor(l, 'bold')?.text === '"b"');
    expect(lineText(bLine!)).not.toContain(',');
  });
});

describe('getLineKeyMap', () => {
  test('flat object maps keys to line indices', () => {
    const map = getLineKeyMap({ id: 1, name: 'test', age: 30 });
    // Line 0 is {, line 1 is id, line 2 is name, line 3 is age, line 4 is }
    expect(map.get(1)).toBe('id');
    expect(map.get(2)).toBe('name');
    expect(map.get(3)).toBe('age');
  });

  test('nested object maps only top-level keys', () => {
    const map = getLineKeyMap({ id: 1, address: { city: 'NYC' } });
    expect(map.get(1)).toBe('id');
    expect(map.get(2)).toBe('address');
    // city should not appear in the map
    const values = [...map.values()];
    expect(values).not.toContain('city');
  });

  test('empty object returns empty map', () => {
    const map = getLineKeyMap({});
    expect(map.size).toBe(0);
  });
});
