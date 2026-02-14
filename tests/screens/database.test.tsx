import React from 'react';
import { describe, test, expect, mock } from 'bun:test';
import { render } from 'ink-testing-library';
import { DatabaseScreen } from '../../src/screens/database.js';
import type { HarperClient } from '../../src/api/client.js';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

const sampleTables = {
  users: {
    schema: 'mydb',
    name: 'users',
    hash_attribute: 'id',
    audit: true,
    schema_defined: true,
    record_count: 150,
    attributes: [
      { attribute: 'id', indexed: false, is_primary_key: true },
      { attribute: 'name', indexed: true, is_primary_key: false },
      { attribute: 'email', indexed: true, is_primary_key: false },
    ],
  },
  posts: {
    schema: 'mydb',
    name: 'posts',
    hash_attribute: 'id',
    audit: true,
    schema_defined: false,
    record_count: 500,
    attributes: [
      { attribute: 'id', indexed: false, is_primary_key: true },
      { attribute: 'title', indexed: false, is_primary_key: false },
    ],
  },
};

function makeClient(data: Record<string, any> = sampleTables, overrides: Partial<HarperClient> = {}): HarperClient {
  return {
    describeAll: mock(() =>
      Promise.resolve({ mydb: data }),
    ),
    describeDatabase: mock(() => Promise.resolve(data)),
    clearCache: mock(() => {}),
    ...overrides,
  } as unknown as HarperClient;
}

describe('DatabaseScreen', () => {
  test('renders table list', async () => {
    const client = makeClient();
    const { lastFrame } = render(
      <DatabaseScreen client={client} database="mydb" onSelectTable={() => {}} />,
    );
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('Tables in');
    expect(frame).toContain('mydb');
    expect(frame).toContain('users');
    expect(frame).toContain('posts');
  });

  test('shows table details: pk, record count, indexed attrs', async () => {
    const client = makeClient();
    const { lastFrame } = render(
      <DatabaseScreen client={client} database="mydb" onSelectTable={() => {}} />,
    );
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('pk: id');
    expect(frame).toContain('150');
    expect(frame).toContain('indexed: name, email');
  });

  test('shows total records summary', async () => {
    const client = makeClient();
    const { lastFrame } = render(
      <DatabaseScreen client={client} database="mydb" onSelectTable={() => {}} />,
    );
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('2 tables');
    expect(frame).toContain('650 total records');
  });

  test('Enter selects a table', async () => {
    const client = makeClient();
    const onSelect = mock(() => {});
    const { stdin } = render(
      <DatabaseScreen client={client} database="mydb" onSelectTable={onSelect} />,
    );
    await tick();

    stdin.write('\r');
    await tick();
    expect(onSelect).toHaveBeenCalled();
  });

  test('shows error state', async () => {
    const client = makeClient({}, {
      describeDatabase: mock(() => Promise.reject(new Error('DB not found'))),
    });
    const { lastFrame } = render(
      <DatabaseScreen client={client} database="mydb" onSelectTable={() => {}} />,
    );
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('DB not found');
    expect(frame).toContain('Press r to retry');
  });

  test('shows empty state when no tables', async () => {
    const client = makeClient({});
    const { lastFrame } = render(
      <DatabaseScreen client={client} database="mydb" onSelectTable={() => {}} />,
    );
    await tick();
    expect(lastFrame()).toContain('No tables found');
  });
});
