import React from 'react';
import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { Breadcrumb } from './breadcrumb.js';

describe('Breadcrumb', () => {
  test('single item renders without separator', () => {
    const { lastFrame } = render(<Breadcrumb items={['dug']} />);
    const frame = lastFrame()!;
    expect(frame).toContain('dug');
    expect(frame).not.toContain('>');
  });

  test('multiple items renders with separators', () => {
    const { lastFrame } = render(
      <Breadcrumb items={['dug', 'localhost', 'data']} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('dug');
    expect(frame).toContain('>');
    expect(frame).toContain('localhost');
    expect(frame).toContain('data');
  });

  test('empty items renders without crashing', () => {
    const { lastFrame } = render(<Breadcrumb items={[]} />);
    expect(lastFrame()).toBeDefined();
  });
});
