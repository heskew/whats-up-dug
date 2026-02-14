import React from 'react';
import { describe, test, expect } from 'bun:test';
import { render } from 'ink-testing-library';
import { DataTable } from './data-table.js';

describe('DataTable component', () => {
  test('empty data shows message', () => {
    const { lastFrame } = render(
      <DataTable data={[]} selectedRow={0} page={0} />,
    );
    expect(lastFrame()).toContain("couldn't find anything");
  });

  test('renders header and data rows', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const { lastFrame } = render(
      <DataTable data={data} selectedRow={0} page={0} availableWidth={80} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('id');
    expect(frame).toContain('name');
    expect(frame).toContain('Alice');
    expect(frame).toContain('Bob');
  });

  test('selected row shows triangle marker', () => {
    const data = [
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
    ];
    const { lastFrame } = render(
      <DataTable data={data} selectedRow={0} page={0} availableWidth={80} />,
    );
    expect(lastFrame()).toContain('\u25b6');
  });

  test('custom columns prop limits displayed columns', () => {
    const data = [
      { id: 1, name: 'Alice', email: 'alice@test.com' },
    ];
    const { lastFrame } = render(
      <DataTable data={data} columns={['name']} selectedRow={0} page={0} availableWidth={80} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('name');
    expect(frame).toContain('Alice');
    expect(frame).not.toContain('email');
  });

  test('page indicator shown when multiple pages', () => {
    const data = [{ id: 1, name: 'test' }];
    const { lastFrame } = render(
      <DataTable data={data} selectedRow={0} page={0} totalPages={3} availableWidth={80} />,
    );
    expect(lastFrame()).toContain('page 1/3');
  });

  test('internal columns appear after regular columns', () => {
    const data = [{ name: 'Alice', __createdtime__: 1700000000000, id: 1 }];
    const { lastFrame } = render(
      <DataTable data={data} selectedRow={0} page={0} availableWidth={120} />,
    );
    const frame = lastFrame()!;
    // name and id should appear before __createdtime__
    const namePos = frame.indexOf('name');
    const ctPos = frame.indexOf('__createdtime__');
    expect(namePos).toBeLessThan(ctPos);
  });
});
