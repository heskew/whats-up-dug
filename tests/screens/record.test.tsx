import React from 'react';
import { describe, test, expect, mock } from 'bun:test';
import { render } from 'ink-testing-library';
import { RecordScreen } from '../../src/screens/record.js';
import type { RelationshipInfo } from '../../src/relationships.js';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

const sampleRecord = {
  id: 'abc-123',
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
  __createdtime__: 1700000000000,
  __updatedtime__: 1700000000000,
};

describe('RecordScreen', () => {
  test('renders record header with table and id', () => {
    const { lastFrame } = render(
      <RecordScreen
        record={sampleRecord}
        database="mydb"
        table="users"
        primaryKey="id"
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('mydb.users');
    expect(frame).toContain('abc-123');
  });

  test('renders record field values as JSON', () => {
    const { lastFrame } = render(
      <RecordScreen
        record={sampleRecord}
        database="mydb"
        table="users"
        primaryKey="id"
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('name');
    expect(frame).toContain('Alice');
    expect(frame).toContain('email');
    expect(frame).toContain('alice@example.com');
  });

  test('formats timestamps', () => {
    const { lastFrame } = render(
      <RecordScreen
        record={sampleRecord}
        database="mydb"
        table="users"
        primaryKey="id"
      />,
    );
    const frame = lastFrame()!;
    // Should not contain raw timestamp number
    expect(frame).not.toContain('1700000000000');
  });

  test('shows forward relationship annotations', () => {
    const relationships: RelationshipInfo[] = [
      {
        attribute: 'departmentId',
        targetTable: 'departments',
        direction: 'forward',
        source: 'naming',
      },
    ];
    const record = { id: '1', departmentId: 'dept-1' };
    const { lastFrame } = render(
      <RecordScreen
        record={record}
        database="mydb"
        table="users"
        primaryKey="id"
        relationships={relationships}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('\u2192 departments');
  });

  test('shows reverse relationship hints', () => {
    const relationships: RelationshipInfo[] = [
      {
        attribute: 'id',
        targetTable: 'posts',
        direction: 'reverse',
        source: 'naming',
        reverseAttribute: 'userId',
      },
    ];
    const { lastFrame } = render(
      <RecordScreen
        record={sampleRecord}
        database="mydb"
        table="users"
        primaryKey="id"
        relationships={relationships}
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Referenced by');
    expect(frame).toContain('posts');
    expect(frame).toContain('userId');
  });

  test('handles record with unknown primary key gracefully', () => {
    const { lastFrame } = render(
      <RecordScreen
        record={{ foo: 'bar' }}
        database="mydb"
        table="items"
        primaryKey="id"
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('unknown');
  });
});
