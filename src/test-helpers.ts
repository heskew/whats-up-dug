import type { TableSchema, TableAttribute } from './api/types.js';

/** Build a minimal valid TableSchema for testing */
export function makeSchema(
  name: string,
  attrs: string[],
  overrides?: Partial<TableSchema>,
): TableSchema {
  return {
    schema: 'data',
    name,
    hash_attribute: attrs[0] ?? 'id',
    audit: true,
    schema_defined: false,
    record_count: 0,
    attributes: attrs.map((a) => ({
      attribute: a,
      indexed: false,
      is_primary_key: a === (attrs[0] ?? 'id'),
    })),
    ...overrides,
  } as TableSchema;
}

/** Build a TableAttribute with optional extras (e.g., relationship metadata) */
export function makeAttr(
  name: string,
  extras?: Record<string, unknown>,
): TableAttribute & Record<string, unknown> {
  return { attribute: name, indexed: false, is_primary_key: false, ...extras };
}

/** Mock fetch that returns a sequence of responses */
export function mockFetch(responses: Array<{
  status?: number;
  body?: unknown;
  error?: Error;
}>) {
  let callIndex = 0;
  const calls: Array<{ url: string; body: unknown }> = [];

  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    const parsed = init?.body ? JSON.parse(init.body as string) : {};
    calls.push({ url: String(url), body: parsed });

    const resp = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;

    if (resp.error) throw resp.error;

    return {
      ok: (resp.status ?? 200) >= 200 && (resp.status ?? 200) < 300,
      status: resp.status ?? 200,
      statusText: resp.status === 401 ? 'Unauthorized' : 'OK',
      text: async () => JSON.stringify(resp.body ?? ''),
      json: async () => resp.body,
    } as unknown as Response;
  };

  return { fn, calls };
}
