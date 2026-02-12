import { z } from 'zod';

// ─── Table Schema Types ────────────────────────────────────────────────────────

export const TableAttributeSchema = z.object({
  attribute: z.string(),
  indexed: z.unknown().optional().transform((v) => v === true),
  is_primary_key: z.unknown().optional().transform((v) => v === true),
});
export type TableAttribute = z.infer<typeof TableAttributeSchema>;

export const TableSchemaSchema = z
  .object({
    schema: z.string(),
    name: z.string(),
    hash_attribute: z.string(),
    audit: z.boolean(),
    schema_defined: z.boolean(),
    attributes: z.array(TableAttributeSchema),
    record_count: z.number(),
  })
  .catchall(z.unknown()); // allow db_size, table_size, etc.
export type TableSchema = z.infer<typeof TableSchemaSchema>;

export const DescribeAllResponseSchema = z.record(
  z.string(),
  z.record(z.string(), TableSchemaSchema),
);
export type DescribeAllResponse = z.infer<typeof DescribeAllResponseSchema>;

// ─── Query Types ───────────────────────────────────────────────────────────────

export const ComparatorSchema = z.enum([
  'equals',
  'not_equal',
  'contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'greater_than_equal',
  'less_than',
  'less_than_equal',
  'between',
]);
export type Comparator = z.infer<typeof ComparatorSchema>;

export const ConditionSchema = z.object({
  attribute: z.string(),
  comparator: ComparatorSchema,
  value: z.any(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const ConditionGroupSchema: z.ZodType<ConditionGroup> = z.lazy(() =>
  z.object({
    operator: z.enum(['and', 'or']),
    conditions: z.array(z.union([ConditionSchema, ConditionGroupSchema])),
  }),
) as z.ZodType<ConditionGroup>;
export type ConditionGroup = {
  operator: 'and' | 'or';
  conditions: (Condition | ConditionGroup)[];
};

export const SortSpecSchema: z.ZodType<SortSpec> = z.lazy(() =>
  z.object({
    attribute: z.string(),
    descending: z.boolean().optional(),
    next: SortSpecSchema.optional(),
  }),
) as z.ZodType<SortSpec>;
export type SortSpec = {
  attribute: string;
  descending?: boolean;
  next?: SortSpec;
};

// ─── Search Params ─────────────────────────────────────────────────────────────

export const SearchByIdParamsSchema = z.object({
  database: z.string().optional(),
  table: z.string(),
  ids: z.array(z.any()),
  getAttributes: z.array(z.string()).optional(),
});
export type SearchByIdParams = z.infer<typeof SearchByIdParamsSchema>;

export const SearchByValueParamsSchema = z.object({
  database: z.string().optional(),
  table: z.string(),
  attribute: z.string(),
  value: z.string(),
  getAttributes: z.array(z.string()).optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});
export type SearchByValueParams = z.infer<typeof SearchByValueParamsSchema>;

export const SearchByConditionsParamsSchema = z.object({
  database: z.string().optional(),
  table: z.string(),
  conditions: z.array(z.union([ConditionSchema, ConditionGroupSchema])),
  operator: z.enum(['and', 'or']).optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
  sort: SortSpecSchema.optional(),
  getAttributes: z.array(z.string()).optional(),
});
export type SearchByConditionsParams = z.infer<typeof SearchByConditionsParamsSchema>;

// ─── System Info ───────────────────────────────────────────────────────────────
// Harper's system_information returns top-level keys: system, time, cpu, memory,
// disk, network, harperdb_processes, threads, etc. All loosely typed.

export const SystemInfoSchema = z
  .object({
    system: z
      .object({
        platform: z.string().optional(),
        arch: z.string().optional(),
        hostname: z.string().optional(),
        node_version: z.string().optional(),
      })
      .catchall(z.unknown()),
    time: z
      .object({
        uptime: z.number().optional(),
      })
      .catchall(z.unknown())
      .optional(),
    cpu: z
      .object({
        brand: z.string().optional(),
        cores: z.number().optional(),
        speed: z.number().optional(),
        current_load: z
          .object({
            currentLoad: z.number().optional(),
          })
          .catchall(z.unknown())
          .optional(),
      })
      .catchall(z.unknown())
      .optional(),
    memory: z
      .object({
        total: z.number().optional(),
        free: z.number().optional(),
        used: z.number().optional(),
        active: z.number().optional(),
        available: z.number().optional(),
      })
      .catchall(z.unknown())
      .optional(),
    threads: z.array(z.record(z.string(), z.unknown())).optional(),
  })
  .catchall(z.unknown());
export type SystemInfo = z.infer<typeof SystemInfoSchema>;
