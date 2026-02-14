import { describe, test, expect } from 'bun:test';
import {
  TableAttributeSchema,
  TableSchemaSchema,
  DescribeAllResponseSchema,
  ComparatorSchema,
  SortSpecSchema,
  SystemInfoSchema,
} from './types.js';

describe('TableAttributeSchema', () => {
  test('basic valid attribute with defaults', () => {
    const result = TableAttributeSchema.parse({ attribute: 'id' });
    expect(result.attribute).toBe('id');
    expect(result.indexed).toBe(false);
    expect(result.is_primary_key).toBe(false);
  });

  test('indexed: true stays true', () => {
    const result = TableAttributeSchema.parse({ attribute: 'name', indexed: true });
    expect(result.indexed).toBe(true);
  });

  test('indexed: object (Harper quirk) transforms to false', () => {
    const result = TableAttributeSchema.parse({ attribute: 'name', indexed: { type: 'btree' } });
    expect(result.indexed).toBe(false);
  });

  test('indexed: false stays false', () => {
    const result = TableAttributeSchema.parse({ attribute: 'name', indexed: false });
    expect(result.indexed).toBe(false);
  });

  test('indexed: missing becomes false', () => {
    const result = TableAttributeSchema.parse({ attribute: 'name' });
    expect(result.indexed).toBe(false);
  });

  test('is_primary_key: true stays true', () => {
    const result = TableAttributeSchema.parse({ attribute: 'id', is_primary_key: true });
    expect(result.is_primary_key).toBe(true);
  });

  test('is_primary_key: truthy non-boolean becomes false', () => {
    const result = TableAttributeSchema.parse({ attribute: 'id', is_primary_key: 1 });
    expect(result.is_primary_key).toBe(false);
  });

  test('missing attribute field throws', () => {
    expect(() => TableAttributeSchema.parse({})).toThrow();
  });
});

describe('TableSchemaSchema', () => {
  const validSchema = {
    schema: 'data',
    name: 'User',
    hash_attribute: 'id',
    audit: true,
    schema_defined: false,
    attributes: [{ attribute: 'id', indexed: true, is_primary_key: true }],
    record_count: 42,
  };

  test('valid full schema parses correctly', () => {
    const result = TableSchemaSchema.parse(validSchema);
    expect(result.name).toBe('User');
    expect(result.record_count).toBe(42);
    expect(result.attributes).toHaveLength(1);
    expect(result.attributes[0].indexed).toBe(true);
  });

  test('catchall preserves extra fields', () => {
    const result = TableSchemaSchema.parse({ ...validSchema, db_size: 1024, table_size: 512 });
    expect((result as any).db_size).toBe(1024);
    expect((result as any).table_size).toBe(512);
  });

  test('missing record_count throws', () => {
    const { record_count, ...missing } = validSchema;
    expect(() => TableSchemaSchema.parse(missing)).toThrow();
  });

  test('missing attributes throws', () => {
    const { attributes, ...missing } = validSchema;
    expect(() => TableSchemaSchema.parse(missing)).toThrow();
  });
});

describe('DescribeAllResponseSchema', () => {
  test('valid nested structure parses', () => {
    const input = {
      data: {
        User: {
          schema: 'data',
          name: 'User',
          hash_attribute: 'id',
          audit: true,
          schema_defined: false,
          attributes: [{ attribute: 'id' }],
          record_count: 10,
        },
      },
    };
    const result = DescribeAllResponseSchema.parse(input);
    expect(result.data.User.name).toBe('User');
  });

  test('empty object parses', () => {
    const result = DescribeAllResponseSchema.parse({});
    expect(Object.keys(result)).toHaveLength(0);
  });
});

describe('ComparatorSchema', () => {
  const validComparators = [
    'equals', 'not_equal', 'contains', 'starts_with', 'ends_with',
    'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal', 'between',
  ];

  test.each(validComparators)('valid comparator: %s', (comp) => {
    expect(ComparatorSchema.parse(comp)).toBe(comp);
  });

  test('invalid comparator throws', () => {
    expect(() => ComparatorSchema.parse('not_a_comparator')).toThrow();
  });
});

describe('SortSpecSchema', () => {
  test('simple sort', () => {
    const result = SortSpecSchema.parse({ attribute: 'name' });
    expect(result.attribute).toBe('name');
    expect(result.descending).toBeUndefined();
  });

  test('nested sort', () => {
    const result = SortSpecSchema.parse({
      attribute: 'name',
      descending: true,
      next: { attribute: 'id' },
    });
    expect(result.attribute).toBe('name');
    expect(result.descending).toBe(true);
    expect(result.next?.attribute).toBe('id');
  });
});

describe('SystemInfoSchema', () => {
  test('minimal valid payload', () => {
    const result = SystemInfoSchema.parse({ system: {} });
    expect(result.system).toBeDefined();
  });

  test('full realistic payload', () => {
    const result = SystemInfoSchema.parse({
      system: { platform: 'linux', arch: 'x64', hostname: 'prod-1', node_version: '22.0.0' },
      time: { uptime: 86400 },
      cpu: { brand: 'Intel', cores: 8, speed: 3.5, current_load: { currentLoad: 45.2 } },
      memory: { total: 16000000000, free: 8000000000, used: 8000000000, active: 6000000000, available: 10000000000 },
      threads: [{ pid: 1234, name: 'worker' }],
    });
    expect(result.system.platform).toBe('linux');
    expect(result.cpu?.cores).toBe(8);
    expect(result.memory?.total).toBe(16000000000);
  });

  test('extra unknown top-level keys preserved', () => {
    const result = SystemInfoSchema.parse({
      system: {},
      harperdb_processes: { core: { pid: 1234 } },
      custom_field: 'hello',
    });
    expect((result as any).harperdb_processes).toBeDefined();
    expect((result as any).custom_field).toBe('hello');
  });
});
