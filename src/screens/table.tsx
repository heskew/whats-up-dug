import React, { useState, useEffect, useCallback, useMemo, type MutableRefObject } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import { HarperClient } from '../api/client.js';
import { useApi } from '../hooks/use-api.js';
import { DataTable } from '../components/data-table.js';
import { QueryBuilder } from '../components/query-builder.js';
import { useTerminalSize } from '../hooks/use-terminal-size.js';
import { inferRelationships, type RelationshipInfo } from '../relationships.js';
import type { TableSchema, Condition, ConditionGroup, SortSpec } from '../api/types.js';

interface TableScreenProps {
  client: HarperClient;
  database: string;
  table: string;
  onSelectRecord: (record: Record<string, any>, primaryKey?: string) => void;
  overlayActive?: MutableRefObject<boolean>;
}

type OverlayMode = 'none' | 'search' | 'sort' | 'columns' | 'query' | 'schema-info';

export function TableScreen({
  client,
  database,
  table,
  onSelectRecord,
  overlayActive,
}: TableScreenProps) {
  const { tablePageSize, rows: termRows, columns: termCols } = useTerminalSize();
  const { stdout } = useStdout();
  const [selectedRow, setSelectedRow] = useState(0);
  const [page, setPage] = useState(0);
  const [conditions, setConditions] = useState<(Condition | ConditionGroup)[]>([]);
  const [operator, setOperator] = useState<'and' | 'or'>('and');
  const [sort, setSort] = useState<SortSpec | undefined>(undefined);
  const [customLimit, setCustomLimit] = useState<number | undefined>(undefined);
  const limit = customLimit ?? tablePageSize;
  const [visibleColumns, setVisibleColumns] = useState<string[] | undefined>(undefined);
  const [overlay, _setOverlay] = useState<OverlayMode>('none');
  const setOverlay = useCallback((mode: OverlayMode, prev?: OverlayMode) => {
    // Clear screen when toggling schema-info to avoid stale lines
    if (mode === 'schema-info' || prev === 'schema-info') {
      stdout.write('\x1b[2J\x1b[H');
    }
    _setOverlay(mode);
    if (overlayActive) overlayActive.current = mode !== 'none';
  }, [overlayActive, stdout]);
  const [filterSummary, setFilterSummary] = useState('');

  // Search overlay state
  const [searchAttr, setSearchAttr] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [searchStep, setSearchStep] = useState<'attr' | 'val'>('attr');

  // Sort overlay state
  const [sortAttr, setSortAttr] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortStep, setSortStep] = useState<'attr' | 'dir'>('attr');

  // Column picker state
  const [columnToggles, setColumnToggles] = useState<Record<string, boolean>>({});
  const [columnIdx, setColumnIdx] = useState(0);

  // Horizontal column scroll
  const [colStart, setColStart] = useState(0);

  // Schema info overlay scroll
  const [schemaScroll, setSchemaScroll] = useState(0);

  // Fetch schema
  const describeTable = useCallback(
    () => client.describeTable(database, table),
    [client, database, table],
  );
  const {
    data: schema,
    loading: schemaLoading,
  } = useApi<TableSchema>(describeTable, true);

  // Fetch full database schema for relationship inference
  const describeDb = useCallback(
    () => client.describeDatabase(database),
    [client, database],
  );
  const { data: dbSchema } = useApi<Record<string, TableSchema>>(describeDb, true);

  // Infer relationships
  const relationships = useMemo<RelationshipInfo[]>(() => {
    if (!schema || !dbSchema) return [];
    return inferRelationships(table, schema, dbSchema);
  }, [table, schema, dbSchema]);

  // Fetch data — pass hashAttribute so empty-conditions fallback uses the right PK
  const hashAttr = schema?.hash_attribute;
  const fetchData = useCallback(
    () =>
      client.searchByConditions({
        database,
        table,
        conditions,
        operator,
        offset: page * tablePageSize,
        limit,
        sort,
        getAttributes: ['*'],
        hashAttribute: hashAttr,
      }),
    [client, database, table, conditions, operator, page, limit, sort, hashAttr],
  );
  const {
    data: rows,
    loading: dataLoading,
    error,
    queryTime,
    execute: executeQuery,
  } = useApi<Record<string, any>[]>(fetchData, true);

  // Search by value
  const searchByValue = useCallback(
    (attr: string, val: string) =>
      client.searchByValue({
        database,
        table,
        attribute: attr,
        value: val,
        getAttributes: ['*'],
      }),
    [client, database, table],
  );
  const {
    data: searchResults,
    execute: executeSearch,
  } = useApi<Record<string, any>[]>(searchByValue);

  const displayData = useMemo(() => {
    if (searchResults && filterSummary.startsWith('search:')) return searchResults;
    return rows ?? [];
  }, [rows, searchResults, filterSummary]);

  const allAttributes = useMemo(() => {
    if (!schema) return [];
    return schema.attributes.map((a) => a.attribute);
  }, [schema]);

  const indexedAttributes = useMemo(() => {
    if (!schema) return [];
    return schema.attributes.filter((a) => a.indexed && !a.is_primary_key).map((a) => a.attribute);
  }, [schema]);

  // Reset selected row and column scroll when data changes
  useEffect(() => {
    setSelectedRow(0);
    setColStart(0);
  }, [page, conditions, sort]);

  // Init column toggles from schema
  useEffect(() => {
    if (allAttributes.length > 0 && Object.keys(columnToggles).length === 0) {
      const toggles: Record<string, boolean> = {};
      for (const attr of allAttributes) {
        toggles[attr] = true;
      }
      setColumnToggles(toggles);
    }
  }, [allAttributes, columnToggles]);

  const totalPages = useMemo(() => {
    if (!schema) return undefined;
    return Math.max(1, Math.ceil(schema.record_count / tablePageSize));
  }, [schema, tablePageSize]);

  // Build schema info lines for overlay
  const schemaInfoLines = useMemo(() => {
    if (!schema) return [];
    const lines: string[] = [];
    const raw = schema as Record<string, unknown>;
    lines.push(`Table: ${schema.name}`);
    lines.push(`Primary Key: ${schema.hash_attribute}`);
    lines.push(`Records: ${schema.record_count.toLocaleString()}`);
    lines.push(`Schema Defined: ${schema.schema_defined ? 'yes' : 'no'}`);
    lines.push(`Audit: ${schema.audit ? 'yes' : 'no'}`);

    // Surface extra metadata from API if present
    if (raw.expiration != null) lines.push(`Expiration: ${String(raw.expiration)}`);
    if (raw.ttl != null) lines.push(`TTL: ${String(raw.ttl)}`);
    if (raw.export != null) lines.push(`Export: ${String(raw.export)}`);
    if (raw.table_size != null) lines.push(`Table Size: ${String(raw.table_size)}`);
    if (raw.db_size != null) lines.push(`DB Size: ${String(raw.db_size)}`);
    if (raw.clustering != null) lines.push(`Clustering: ${String(raw.clustering)}`);

    lines.push('');
    lines.push('Attributes:');
    for (const attr of schema.attributes) {
      let badge = '';
      if (attr.is_primary_key) badge = ' [PK]';
      else if (attr.indexed) badge = ' [indexed]';
      lines.push(`  ${attr.attribute}${badge}`);
    }

    const fwd = relationships.filter((r) => r.direction === 'forward');
    const rev = relationships.filter((r) => r.direction === 'reverse');
    if (fwd.length > 0 || rev.length > 0) {
      lines.push('');
      lines.push('Relationships:');
      for (const r of fwd) {
        const src = r.source === 'api' ? '' : ' (inferred)';
        lines.push(`  ${r.attribute} \u2192 ${r.targetTable}${src}`);
      }
      for (const r of rev) {
        lines.push(`  \u2190 ${r.targetTable}.${r.reverseAttribute}`);
      }
    }
    return lines;
  }, [schema, relationships]);

  useInput(
    (input, key) => {
      if (overlay !== 'none') return;

      if (input === 'j' || key.downArrow) {
        setSelectedRow((i) => Math.min(i + 1, displayData.length - 1));
        return;
      }
      if (input === 'k' || key.upArrow) {
        setSelectedRow((i) => Math.max(i - 1, 0));
        return;
      }
      if (key.return && displayData.length > 0) {
        onSelectRecord(displayData[selectedRow], schema?.hash_attribute);
        return;
      }
      if (input === 'n') {
        setPage((p) => p + 1);
        return;
      }
      if (input === 'p' && page > 0) {
        setPage((p) => p - 1);
        return;
      }
      if (input === 'f') {
        setOverlay('query');
        return;
      }
      if (input === '/') {
        setSearchAttr('');
        setSearchVal('');
        setSearchStep('attr');
        setOverlay('search');
        return;
      }
      if (input === 'c') {
        setColumnIdx(0);
        setOverlay('columns');
        return;
      }
      if (input === 's') {
        setSortAttr('');
        setSortDir('asc');
        setSortStep('attr');
        setOverlay('sort');
        return;
      }
      if (input === 'i') {
        setSchemaScroll(0);
        setOverlay('schema-info', 'none');
        return;
      }
      if (input === 'h' || key.leftArrow) {
        setColStart((c) => Math.max(0, c - 1));
        return;
      }
      if (input === 'l' || key.rightArrow) {
        setColStart((c) => Math.min(c + 1, Math.max(0, allAttributes.length - 1)));
        return;
      }
      if (input === 'r') {
        client.clearCache();
        setFilterSummary('');
        executeQuery();
        return;
      }
    },
    { isActive: overlay === 'none' && !dataLoading },
  );

  // Search overlay input
  useInput(
    (input, key) => {
      if (overlay !== 'search') return;

      if (key.escape) {
        setOverlay('none');
        return;
      }

      if (searchStep === 'attr') {
        if (key.return) {
          if (searchAttr.trim()) {
            setSearchStep('val');
          }
          return;
        }
        if (key.backspace) {
          setSearchAttr((t) => t.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setSearchAttr((t) => t + input);
        }
      } else {
        if (key.return) {
          if (searchVal.trim()) {
            setFilterSummary(`search: ${searchAttr}=${searchVal}`);
            executeSearch(searchAttr.trim(), searchVal.trim());
            setOverlay('none');
          }
          return;
        }
        if (key.backspace) {
          setSearchVal((t) => t.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setSearchVal((t) => t + input);
        }
      }
    },
    { isActive: overlay === 'search' },
  );

  // Sort overlay input
  useInput(
    (input, key) => {
      if (overlay !== 'sort') return;

      if (key.escape) {
        setOverlay('none');
        return;
      }

      if (sortStep === 'attr') {
        if (key.return && sortAttr.trim()) {
          setSortStep('dir');
          return;
        }
        if (key.backspace) {
          setSortAttr((t) => t.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) {
          setSortAttr((t) => t + input);
        }
      } else {
        if (input === 'a') {
          setSortDir('asc');
          setSort({ attribute: sortAttr.trim(), descending: false });
          setPage(0);
          setOverlay('none');
          // Re-fetch will happen due to sort dependency change
          return;
        }
        if (input === 'd') {
          setSortDir('desc');
          setSort({ attribute: sortAttr.trim(), descending: true });
          setPage(0);
          setOverlay('none');
          return;
        }
      }
    },
    { isActive: overlay === 'sort' },
  );

  // Column picker input
  useInput(
    (input, key) => {
      if (overlay !== 'columns') return;

      if (key.escape) {
        const selected = allAttributes.filter((a) => columnToggles[a]);
        setVisibleColumns(selected.length === allAttributes.length ? undefined : selected);
        setOverlay('none');
        return;
      }
      if (key.downArrow || input === 'j') {
        setColumnIdx((i) => Math.min(i + 1, allAttributes.length - 1));
        return;
      }
      if (key.upArrow || input === 'k') {
        setColumnIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (input === ' ' || key.return) {
        const attr = allAttributes[columnIdx];
        setColumnToggles((prev) => ({ ...prev, [attr]: !prev[attr] }));
        return;
      }
    },
    { isActive: overlay === 'columns' },
  );

  // Schema info overlay input
  useInput(
    (input, key) => {
      if (overlay !== 'schema-info') return;

      if (key.escape) {
        setOverlay('none', 'schema-info');
        return;
      }
      const maxScroll = Math.max(0, schemaInfoLines.length - (termRows - 12));
      if (input === 'j' || key.downArrow) {
        setSchemaScroll((s) => Math.min(s + 1, maxScroll));
        return;
      }
      if (input === 'k' || key.upArrow) {
        setSchemaScroll((s) => Math.max(s - 1, 0));
        return;
      }
    },
    { isActive: overlay === 'schema-info' },
  );

  // Note: QueryBuilder handles its own input via its useInput hook

  // Re-fetch when sort changes
  useEffect(() => {
    if (sort) {
      executeQuery();
    }
  }, [sort, executeQuery]);

  // Build indexed columns display string
  const indexedDisplay = useMemo(() => {
    if (indexedAttributes.length === 0) return '';
    const maxShow = 3;
    const shown = indexedAttributes.slice(0, maxShow).join(', ');
    const extra = indexedAttributes.length > maxShow
      ? ` +${indexedAttributes.length - maxShow} more`
      : '';
    return `indexed: ${shown}${extra}`;
  }, [indexedAttributes]);

  if (schemaLoading && !schema) {
    return (
      <Box paddingX={1}>
        <Text>
          <Spinner type="dots" /> Loading {table}...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="red">{error}</Text>
        <Text dimColor>Press r to retry</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2}>
      {/* Header */}
      <Box flexDirection="column">
        <Text bold>{'  '}Table <Text color="cyan">{table}</Text></Text>
        <Text dimColor>
          {'  '}{schema?.record_count?.toLocaleString() ?? '?'} record{schema?.record_count === 1 ? '' : 's'}
          {'  \u00b7  '}pk: {schema?.hash_attribute ?? '?'}
          {indexedDisplay ? `  \u00b7  ${indexedDisplay}` : ''}
          {'  \u00b7  '}{queryTime}ms
          {sort ? `  \u00b7  sort: ${sort.attribute} ${sort.descending ? 'DESC' : 'ASC'}` : ''}
        </Text>
      </Box>

      {/* Filter summary */}
      {filterSummary && (
        <Box marginBottom={1}>
          <Text dimColor>Filter: </Text>
          <Text color="yellow">{filterSummary}</Text>
          <Text dimColor> (r to clear)</Text>
        </Box>
      )}

      {/* Overlays replace the data table to avoid clipping under overflow:hidden */}
      {overlay === 'search' ? (
        <Box flexDirection="column" borderStyle="round" borderColor="yellow" paddingX={1}>
          <Text bold color="yellow">Quick Search</Text>
          <Box>
            <Text>Attribute: </Text>
            <Text>{searchAttr}</Text>
            {searchStep === 'attr' && <Text dimColor>|</Text>}
          </Box>
          {searchStep === 'val' && (
            <Box>
              <Text>Value: </Text>
              <Text>{searchVal}</Text>
              <Text dimColor>|</Text>
            </Box>
          )}
          <Text dimColor>Enter to confirm, Esc to cancel</Text>
          {allAttributes.length > 0 && searchStep === 'attr' && (
            <Text dimColor>
              Available: {allAttributes.slice(0, 8).join(', ')}
              {allAttributes.length > 8 ? '...' : ''}
            </Text>
          )}
        </Box>
      ) : overlay === 'sort' ? (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
          <Text bold color="cyan">Sort</Text>
          {sortStep === 'attr' ? (
            <>
              <Box>
                <Text>Attribute: </Text>
                <Text>{sortAttr}</Text>
                <Text dimColor>|</Text>
              </Box>
              <Text dimColor>
                Available: {allAttributes.slice(0, 8).join(', ')}
                {allAttributes.length > 8 ? '...' : ''}
              </Text>
            </>
          ) : (
            <>
              <Text>Attribute: {sortAttr}</Text>
              <Text>Press a for ASC, d for DESC</Text>
            </>
          )}
          <Text dimColor>Esc to cancel</Text>
        </Box>
      ) : overlay === 'columns' ? (
        <Box flexDirection="column" borderStyle="round" borderColor="green" paddingX={1}>
          <Text bold color="green">Column Picker</Text>
          <Text dimColor>Space to toggle, Esc to apply</Text>
          {allAttributes.map((attr, i) => (
            <Box key={attr}>
              <Text inverse={i === columnIdx}>
                {columnToggles[attr] ? '[x] ' : '[ ] '}
                {attr}
              </Text>
            </Box>
          ))}
        </Box>
      ) : overlay === 'query' ? (
        <Box flexDirection="column" borderStyle="round" borderColor="magenta" paddingX={1}>
          <QueryBuilder
            attributes={allAttributes}
            defaultLimit={tablePageSize}
            onExecute={(conds, op, s, lim) => {
              setConditions(conds);
              setOperator(op);
              setSort(s);
              if (lim) setCustomLimit(lim);
              setPage(0);
              setFilterSummary(
                conds.length > 0
                  ? `${conds.map((c) => `${c.attribute} ${c.comparator} ${c.value}`).join(` ${op} `)}`
                  : '',
              );
              setOverlay('none');
              executeQuery();
            }}
            onCancel={() => setOverlay('none')}
          />
        </Box>
      ) : overlay === 'schema-info' ? (
        <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
          <Text bold color="blue">Schema Info</Text>
          <Text dimColor>j/k to scroll, Esc to close</Text>
          <Box flexDirection="column" marginTop={1}>
            {schemaInfoLines
              .slice(schemaScroll, schemaScroll + Math.max(1, termRows - 12))
              .map((line, i) => (
                <Text key={i}>{line}</Text>
              ))}
          </Box>
          {schemaInfoLines.length > termRows - 12 && (
            <Text dimColor>
              {schemaScroll + 1}-{Math.min(schemaScroll + termRows - 12, schemaInfoLines.length)} of {schemaInfoLines.length}
            </Text>
          )}
        </Box>
      ) : (
        <>
          {/* Data table */}
          <Box flexDirection="column">
            {dataLoading && !rows ? (
              <Text>
                <Spinner type="dots" /> Loading data...
              </Text>
            ) : (
              <DataTable
                data={displayData}
                columns={visibleColumns}
                selectedRow={selectedRow}
                page={page}
                totalPages={totalPages}
                colStart={colStart}
                availableWidth={termCols - 4}
              />
            )}
          </Box>

          {dataLoading && rows && (
            <Box marginTop={1}>
              <Text dimColor>
                <Spinner type="dots" /> Loading...
              </Text>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
