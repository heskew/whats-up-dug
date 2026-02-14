import React from 'react';
import { describe, test, expect, mock } from 'bun:test';
import { render } from 'ink-testing-library';
import { DashboardScreen } from './dashboard.js';
import type { HarperClient } from '../api/client.js';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function makeClient(data: Record<string, any> = {}, overrides: Partial<HarperClient> = {}): HarperClient {
  return {
    describeAll: mock(() => Promise.resolve(data)),
    clearCache: mock(() => {}),
    ...overrides,
  } as unknown as HarperClient;
}

const sampleData = {
  mydb: {
    users: {
      schema: 'mydb',
      name: 'users',
      hash_attribute: 'id',
      audit: true,
      schema_defined: false,
      record_count: 100,
      attributes: [{ attribute: 'id', indexed: false, is_primary_key: true }],
    },
    posts: {
      schema: 'mydb',
      name: 'posts',
      hash_attribute: 'id',
      audit: true,
      schema_defined: false,
      record_count: 250,
      attributes: [{ attribute: 'id', indexed: false, is_primary_key: true }],
    },
  },
  testdb: {
    items: {
      schema: 'testdb',
      name: 'items',
      hash_attribute: 'id',
      audit: true,
      schema_defined: false,
      record_count: 50,
      attributes: [{ attribute: 'id', indexed: false, is_primary_key: true }],
    },
  },
};

describe('DashboardScreen', () => {
  test('renders database list', async () => {
    const client = makeClient(sampleData);
    const { lastFrame } = render(
      <DashboardScreen
        client={client}
        url="http://localhost:9925"
        onSelectDatabase={() => {}}
        onSystemInfo={() => {}}
      />,
    );
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('Databases');
    expect(frame).toContain('mydb');
    expect(frame).toContain('testdb');
    expect(frame).toContain('2 tables');
    expect(frame).toContain('1 table');
  });

  test('shows total records and database count', async () => {
    const client = makeClient(sampleData);
    const { lastFrame } = render(
      <DashboardScreen
        client={client}
        url="http://localhost:9925"
        onSelectDatabase={() => {}}
        onSystemInfo={() => {}}
      />,
    );
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('2 databases');
    expect(frame).toContain('400 total records');
  });

  test('shows error state', async () => {
    const client = makeClient({}, {
      describeAll: mock(() => Promise.reject(new Error('Server unreachable'))),
    });
    const { lastFrame } = render(
      <DashboardScreen
        client={client}
        url="http://localhost:9925"
        onSelectDatabase={() => {}}
        onSystemInfo={() => {}}
      />,
    );
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('Server unreachable');
    expect(frame).toContain('Press r to retry');
  });

  test('j/k navigates and Enter selects', async () => {
    const client = makeClient(sampleData);
    const onSelect = mock(() => {});
    const { lastFrame, stdin } = render(
      <DashboardScreen
        client={client}
        url="http://localhost:9925"
        onSelectDatabase={onSelect}
        onSystemInfo={() => {}}
      />,
    );
    await tick();
    // First item selected by default (has triangle marker)
    expect(lastFrame()).toContain('\u25b6');

    // Navigate down
    stdin.write('j');
    await tick();

    // Enter to select
    stdin.write('\r');
    await tick();
    expect(onSelect).toHaveBeenCalled();
  });

  test('shows empty state when no databases', async () => {
    const client = makeClient({});
    const { lastFrame } = render(
      <DashboardScreen
        client={client}
        url="http://localhost:9925"
        onSelectDatabase={() => {}}
        onSystemInfo={() => {}}
      />,
    );
    await tick();
    expect(lastFrame()).toContain('No databases found');
  });

  test('s key triggers system info', async () => {
    const client = makeClient(sampleData);
    const onSystemInfo = mock(() => {});
    const { stdin } = render(
      <DashboardScreen
        client={client}
        url="http://localhost:9925"
        onSelectDatabase={() => {}}
        onSystemInfo={onSystemInfo}
      />,
    );
    await tick();
    stdin.write('s');
    await tick();
    expect(onSystemInfo).toHaveBeenCalled();
  });
});
