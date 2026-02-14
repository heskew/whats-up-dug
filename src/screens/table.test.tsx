import React from 'react';
import { describe, test, expect, mock } from 'bun:test';
import { render } from 'ink-testing-library';
import { TableScreen } from './table.js';
import type { HarperClient } from '../api/client.js';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

const sampleSchema = {
  schema: 'mydb',
  name: 'users',
  hash_attribute: 'id',
  audit: true,
  schema_defined: false,
  record_count: 100,
  attributes: [
    { attribute: 'id', indexed: false, is_primary_key: true },
    { attribute: 'name', indexed: false, is_primary_key: false },
    { attribute: 'email', indexed: true, is_primary_key: false },
  ],
};

const sampleRows = [
  { id: '1', name: 'Alice', email: 'alice@test.com' },
  { id: '2', name: 'Bob', email: 'bob@test.com' },
  { id: '3', name: 'Charlie', email: 'charlie@test.com' },
];

function makeClient(overrides: Partial<HarperClient> = {}): HarperClient {
  return {
    describeAll: mock(() =>
      Promise.resolve({
        mydb: { users: sampleSchema },
      }),
    ),
    describeDatabase: mock(() =>
      Promise.resolve({ users: sampleSchema }),
    ),
    describeTable: mock(() => Promise.resolve(sampleSchema)),
    searchByConditions: mock(() => Promise.resolve(sampleRows)),
    searchByValue: mock(() => Promise.resolve(sampleRows)),
    searchById: mock(() => Promise.resolve(sampleRows)),
    clearCache: mock(() => {}),
    ...overrides,
  } as unknown as HarperClient;
}

describe('TableScreen', () => {
  test('renders data table with rows', async () => {
    const client = makeClient();
    const { lastFrame } = render(
      <TableScreen
        client={client}
        database="mydb"
        table="users"
        onSelectRecord={() => {}}
      />,
    );
    await tick(100);
    const frame = lastFrame()!;
    expect(frame).toContain('users');
    expect(frame).toContain('Alice');
    expect(frame).toContain('Bob');
  });

  test('shows record count and pk info in header', async () => {
    const client = makeClient();
    const { lastFrame } = render(
      <TableScreen
        client={client}
        database="mydb"
        table="users"
        onSelectRecord={() => {}}
      />,
    );
    await tick(100);
    const frame = lastFrame()!;
    expect(frame).toContain('100');
    expect(frame).toContain('pk: id');
  });

  test('shows indexed attributes', async () => {
    const client = makeClient();
    const { lastFrame } = render(
      <TableScreen
        client={client}
        database="mydb"
        table="users"
        onSelectRecord={() => {}}
      />,
    );
    await tick(100);
    expect(lastFrame()).toContain('indexed: email');
  });

  test('shows error state', async () => {
    const client = makeClient({
      searchByValue: mock(() => Promise.reject(new Error('Query failed'))),
      searchByConditions: mock(() => Promise.reject(new Error('Query failed'))),
    });
    const { lastFrame } = render(
      <TableScreen
        client={client}
        database="mydb"
        table="users"
        onSelectRecord={() => {}}
      />,
    );
    await tick(100);
    const frame = lastFrame()!;
    expect(frame).toContain('Query failed');
  });

  test('Enter selects a record', async () => {
    const client = makeClient();
    const onSelect = mock(() => {});
    const { stdin } = render(
      <TableScreen
        client={client}
        database="mydb"
        table="users"
        onSelectRecord={onSelect}
      />,
    );
    await tick(100);

    stdin.write('\r');
    await tick();
    expect(onSelect).toHaveBeenCalled();
  });
});
