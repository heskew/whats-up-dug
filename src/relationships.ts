import type { TableSchema } from './api/types.js';

export interface RelationshipInfo {
  attribute: string;
  targetTable: string;
  direction: 'forward' | 'reverse';
  reverseAttribute?: string;
  source: 'api' | 'inferred';
}

/**
 * Infer relationships for a table by:
 * 1. Checking for API-provided relationship metadata (future-proof)
 * 2. Convention: `fooId` / `foo_id` attributes → `Foo` table (forward)
 * 3. Convention: other tables with `thisTableId` / `this_table_id` → reverse
 */
export function inferRelationships(
  tableName: string,
  tableSchema: TableSchema,
  allTables: Record<string, TableSchema>,
): RelationshipInfo[] {
  const results: RelationshipInfo[] = [];
  const seen = new Set<string>();
  const allTableNames = Object.keys(allTables);
  const tableNameLower = new Map<string, string>();
  for (const name of allTableNames) {
    tableNameLower.set(name.toLowerCase(), name);
  }

  // --- Forward relationships: attributes ending in Id or _id ---
  for (const attr of tableSchema.attributes) {
    const name = attr.attribute;

    // Check for API-provided relationship metadata on the attribute
    const raw = attr as Record<string, unknown>;
    if (raw.relationship && typeof raw.relationship === 'object') {
      const rel = raw.relationship as Record<string, unknown>;
      if (typeof rel.table === 'string') {
        const key = `fwd:${name}:${rel.table}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            attribute: name,
            targetTable: rel.table,
            direction: 'forward',
            source: 'api',
          });
        }
        continue;
      }
    }

    // Convention: camelCase `fooId` or snake_case `foo_id`
    let baseName: string | null = null;

    if (name.endsWith('Id') && name.length > 2) {
      baseName = name.slice(0, -2);
    } else if (name.endsWith('_id') && name.length > 3) {
      baseName = name.slice(0, -3);
    }

    if (!baseName) continue;

    // Match against table names (case-insensitive)
    const match = tableNameLower.get(baseName.toLowerCase());
    if (match && match !== tableName) {
      const key = `fwd:${name}:${match}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          attribute: name,
          targetTable: match,
          direction: 'forward',
          source: 'inferred',
        });
      }
    }
  }

  // --- Reverse relationships: other tables with attributes pointing to this table ---
  for (const [otherName, otherSchema] of Object.entries(allTables)) {
    if (otherName === tableName) continue;

    for (const attr of otherSchema.attributes) {
      const name = attr.attribute;
      let baseName: string | null = null;

      if (name.endsWith('Id') && name.length > 2) {
        baseName = name.slice(0, -2);
      } else if (name.endsWith('_id') && name.length > 3) {
        baseName = name.slice(0, -3);
      }

      if (!baseName) continue;

      if (baseName.toLowerCase() === tableName.toLowerCase()) {
        const key = `rev:${otherName}:${name}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            attribute: name,
            targetTable: otherName,
            direction: 'reverse',
            reverseAttribute: name,
            source: 'inferred',
          });
        }
      }
    }
  }

  return results;
}
