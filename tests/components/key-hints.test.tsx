import React from 'react';
import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { KeyHints } from '../../src/components/key-hints.js';

describe('KeyHints', () => {
  test('single hint renders key and label', () => {
    const { lastFrame } = render(
      <KeyHints hints={[{ key: 'q', label: 'quit' }]} />,
    );
    expect(lastFrame()).toContain('q: quit');
  });

  test('multiple hints joined with spacing', () => {
    const { lastFrame } = render(
      <KeyHints hints={[
        { key: 'j/k', label: 'navigate' },
        { key: 'Enter', label: 'select' },
        { key: 'q', label: 'quit' },
      ]} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('j/k: navigate');
    expect(frame).toContain('Enter: select');
    expect(frame).toContain('q: quit');
  });

  test('empty hints renders without crashing', () => {
    const { lastFrame } = render(<KeyHints hints={[]} />);
    expect(lastFrame()).toBeDefined();
  });
});
