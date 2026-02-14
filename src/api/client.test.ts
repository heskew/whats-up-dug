import { describe, test, expect, beforeEach, afterEach, mock, jest } from 'bun:test';
import { HarperClient, formatZodError, isNetworkError } from './client.js';
import { mockFetch } from '../test-helpers.js';
import { z } from 'zod';

// ─── isNetworkError ────────────────────────────────────────────────────────────

describe('isNetworkError', () => {
  test('TypeError returns true', () => {
    expect(isNetworkError(new TypeError('fetch failed'))).toBe(true);
  });

  test('ECONNREFUSED returns true', () => {
    expect(isNetworkError(new Error('ECONNREFUSED'))).toBe(true);
  });

  test('ECONNRESET returns true', () => {
    expect(isNetworkError(new Error('connect ECONNRESET'))).toBe(true);
  });

  test('ETIMEDOUT returns true', () => {
    expect(isNetworkError(new Error('connect ETIMEDOUT'))).toBe(true);
  });

  test('ENETUNREACH returns true', () => {
    expect(isNetworkError(new Error('ENETUNREACH'))).toBe(true);
  });

  test('socket hang up returns true', () => {
    expect(isNetworkError(new Error('socket hang up'))).toBe(true);
  });

  test('abort returns true', () => {
    expect(isNetworkError(new Error('The operation was aborted'))).toBe(true);
  });

  test('random error returns false', () => {
    expect(isNetworkError(new Error('some random error'))).toBe(false);
  });

  test('non-Error value returns false', () => {
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError('string')).toBe(false);
    expect(isNetworkError(42)).toBe(false);
  });
});

// ─── formatZodError ────────────────────────────────────────────────────────────

describe('formatZodError', () => {
  test('single issue formats correctly', () => {
    try {
      z.object({ name: z.string() }).parse({ name: 123 });
    } catch (err) {
      const result = formatZodError(err as z.ZodError);
      expect(result).toContain('Unexpected response shape:');
      expect(result).toContain('name:');
    }
  });

  test('more than 3 issues shows truncation', () => {
    try {
      z.object({
        a: z.string(),
        b: z.string(),
        c: z.string(),
        d: z.string(),
        e: z.string(),
      }).parse({ a: 1, b: 2, c: 3, d: 4, e: 5 });
    } catch (err) {
      const result = formatZodError(err as z.ZodError);
      expect(result).toContain('...and 2 more');
    }
  });
});

// ─── HarperClient ──────────────────────────────────────────────────────────────

describe('HarperClient', () => {
  const validDescribeAll = {
    data: {
      User: {
        schema: 'data',
        name: 'User',
        hash_attribute: 'id',
        audit: true,
        schema_defined: false,
        attributes: [{ attribute: 'id', indexed: true, is_primary_key: true }],
        record_count: 10,
      },
    },
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('connect() success', async () => {
    const { fn } = mockFetch([{ body: validDescribeAll }]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');
    expect(client.isConnected()).toBe(true);
  });

  test('connect() with 401 throws auth error', async () => {
    const { fn } = mockFetch([{ status: 401, body: 'Unauthorized' }]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await expect(
      client.connect('http://localhost:9925', 'admin', 'wrong'),
    ).rejects.toThrow('Authentication failed');
  });

  test('connect() with network error throws connection error', async () => {
    const { fn } = mockFetch([{ error: new TypeError('fetch failed') }]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await expect(
      client.connect('http://localhost:9925', 'admin', 'password'),
    ).rejects.toThrow('Cannot reach Harper instance');
  });

  test('execute retries on 500', async () => {
    const { fn, calls } = mockFetch([
      { status: 500, body: 'Internal Server Error' },
      { body: validDescribeAll },
    ]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  test('execute does not retry on 400', async () => {
    const { fn, calls } = mockFetch([{ status: 400, body: 'Bad Request' }]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await expect(
      client.connect('http://localhost:9925', 'admin', 'password'),
    ).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  test('execute retries on network error then succeeds', async () => {
    const { fn, calls } = mockFetch([
      { error: new TypeError('fetch failed') },
      { body: validDescribeAll },
    ]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');
    expect(client.isConnected()).toBe(true);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  test('describeAll caches result', async () => {
    const { fn, calls } = mockFetch([{ body: validDescribeAll }]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');
    const callsAfterConnect = calls.length;

    // Second call should be cached
    await client.describeAll();
    expect(calls).toHaveLength(callsAfterConnect);
  });

  test('clearCache causes re-fetch', async () => {
    const { fn, calls } = mockFetch([{ body: validDescribeAll }]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');
    const callsAfterConnect = calls.length;

    client.clearCache();
    await client.describeAll();
    expect(calls.length).toBeGreaterThan(callsAfterConnect);
  });

  test('searchByConditions with empty conditions falls back to searchByValue', async () => {
    const { fn, calls } = mockFetch([
      { body: validDescribeAll },
      { body: [{ id: 1, name: 'test' }] },
    ]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');

    await client.searchByConditions({
      database: 'data',
      table: 'User',
      conditions: [],
      hashAttribute: 'id',
      limit: 10,
      offset: 0,
    });

    const lastCall = calls[calls.length - 1];
    expect(lastCall.body).toHaveProperty('operation', 'search_by_value');
    expect(lastCall.body).toHaveProperty('search_value', '*');
  });

  test('searchByConditions with conditions uses search_by_conditions', async () => {
    const { fn, calls } = mockFetch([
      { body: validDescribeAll },
      { body: [{ id: 1 }] },
    ]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');

    await client.searchByConditions({
      database: 'data',
      table: 'User',
      conditions: [{ attribute: 'name', comparator: 'equals', value: 'test' }],
    });

    const lastCall = calls[calls.length - 1];
    expect(lastCall.body).toHaveProperty('operation', 'search_by_conditions');
    expect(lastCall.body).toHaveProperty('schema', 'data');
  });

  test('searchById uses schema field for database', async () => {
    const { fn, calls } = mockFetch([
      { body: validDescribeAll },
      { body: [{ id: 1 }] },
    ]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');

    await client.searchById({ database: 'data', table: 'User', ids: ['1'] });

    const lastCall = calls[calls.length - 1];
    expect(lastCall.body).toHaveProperty('schema', 'data');
    expect(lastCall.body).not.toHaveProperty('database');
  });

  test('systemInformation parses valid response', async () => {
    const sysInfo = {
      system: { platform: 'linux', arch: 'x64' },
      time: { uptime: 1000 },
    };
    const { fn } = mockFetch([
      { body: validDescribeAll },
      { body: sysInfo },
    ]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');
    const result = await client.systemInformation();
    expect(result.system.platform).toBe('linux');
  });

  test('getLastQueryTime returns elapsed time', async () => {
    const { fn } = mockFetch([{ body: validDescribeAll }]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925', 'admin', 'password');
    expect(client.getLastQueryTime()).toBeGreaterThanOrEqual(0);
  });

  test('connect strips trailing slashes from URL', async () => {
    const { fn, calls } = mockFetch([{ body: validDescribeAll }]);
    globalThis.fetch = fn as typeof fetch;

    const client = new HarperClient();
    await client.connect('http://localhost:9925///', 'admin', 'password');
    expect(calls[0].url).toBe('http://localhost:9925');
  });
});
