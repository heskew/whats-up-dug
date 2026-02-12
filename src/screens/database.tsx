import React, { useState, useEffect, useCallback, useMemo, type MutableRefObject } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import Fuse from 'fuse.js';
import { HarperClient } from '../api/client.js';
import { useApi } from '../hooks/use-api.js';
import type { TableSchema } from '../api/types.js';

interface DatabaseScreenProps {
  client: HarperClient;
  database: string;
  onSelectTable: (table: string) => void;
  overlayActive?: MutableRefObject<boolean>;
}

interface TableSummary {
  name: string;
  hashAttribute: string;
  recordCount: number;
  indexedAttributes: string[];
}

export function DatabaseScreen({
  client,
  database,
  onSelectTable,
  overlayActive,
}: DatabaseScreenProps) {
  const describeDb = useCallback(
    () => client.describeDatabase(database),
    [client, database],
  );
  const { data, loading, error, queryTime, execute } = useApi(describeDb, true);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const tables: TableSummary[] = useMemo(() => {
    if (!data) return [];
    return Object.values(data).map((schema: TableSchema) => ({
      name: schema.name,
      hashAttribute: schema.hash_attribute,
      recordCount: schema.record_count,
      indexedAttributes: schema.attributes
        .filter((a) => a.indexed)
        .map((a) => a.attribute),
    }));
  }, [data]);

  const filteredTables = useMemo(() => {
    if (!filterText) return tables;
    const fuse = new Fuse(tables, { keys: ['name'], threshold: 0.4 });
    return fuse.search(filterText).map((r) => r.item);
  }, [tables, filterText]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filterText]);

  useEffect(() => {
    if (overlayActive) overlayActive.current = showFilter;
  }, [showFilter, overlayActive]);

  useInput(
    (input, key) => {
      if (showFilter) return;

      if (input === 'j' || key.downArrow) {
        setSelectedIndex((i) =>
          Math.min(i + 1, filteredTables.length - 1),
        );
        return;
      }
      if (input === 'k' || key.upArrow) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (key.return && filteredTables.length > 0) {
        onSelectTable(filteredTables[selectedIndex].name);
        return;
      }
      if (input === '/') {
        setShowFilter(true);
        return;
      }
      if (input === 'i') {
        setExpandedIndex(
          expandedIndex === selectedIndex ? null : selectedIndex,
        );
        return;
      }
      if (input === 'r') {
        client.clearCache();
        execute();
        return;
      }
    },
    { isActive: !loading && !showFilter },
  );

  const totalRecords = useMemo(
    () => tables.reduce((sum, t) => sum + t.recordCount, 0),
    [tables],
  );

  const handleFilterDone = useCallback(
    (text: string) => {
      setFilterText(text);
      setShowFilter(false);
    },
    [],
  );

  if (loading && !data) {
    return (
      <Box paddingX={1}>
        <Text>
          <Spinner type="dots" /> Loading tables for {database}...
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
      <Box marginBottom={1} flexDirection="column">
        <Text bold>Tables in <Text color="cyan">{database}</Text></Text>
        <Text dimColor>
          {tables.length} table{tables.length === 1 ? '' : 's'}  {'\u00b7'}  {totalRecords.toLocaleString()} total records  {'\u00b7'}  {queryTime}ms
        </Text>
      </Box>

      {filterText && (
        <Box marginBottom={1}>
          <Text dimColor>Filter: </Text>
          <Text color="yellow">{filterText}</Text>
          <Text dimColor> (Esc to clear)</Text>
        </Box>
      )}

      {showFilter && (
        <Box marginBottom={1}>
          <DatabaseFilterInline
            items={tables.map((t) => t.name)}
            onDone={handleFilterDone}
            onCancel={() => {
              setFilterText('');
              setShowFilter(false);
            }}
          />
        </Box>
      )}

      {/* Table list */}
      <Box flexDirection="column">
        {filteredTables.length === 0 && !loading ? (
          <Box flexDirection="column">
            <Text dimColor>  No tables found.</Text>
            <Text dimColor>  Create one in Harper Studio or via the Operations API.</Text>
          </Box>
        ) : (
          filteredTables.map((table, i) => {
            const selected = i === selectedIndex;
            return (
              <Box key={table.name} flexDirection="column">
                <Box>
                  <Text color={selected ? 'cyan' : undefined} bold={selected}>
                    {selected ? ' \u25b6 ' : '   '}
                  </Text>
                  <Text bold={selected} inverse={selected}>
                    {' '}{table.name}{' '}
                  </Text>
                  <Text dimColor>
                    {'  '}pk: {table.hashAttribute}
                    {'  \u00b7  '}{table.recordCount.toLocaleString()} record{table.recordCount === 1 ? '' : 's'}
                    {table.indexedAttributes.length > 0 &&
                      `  \u00b7  indexed: ${table.indexedAttributes.join(', ')}`}
                  </Text>
                </Box>
                {expandedIndex === i && data && (
                  <Box flexDirection="column" marginLeft={6} marginTop={0} marginBottom={1}>
                    {(() => {
                      const schema = Object.values(data).find(
                        (s) => s.name === table.name,
                      );
                      if (!schema) return null;
                      return (
                        <>
                          <Text dimColor>
                            Schema defined: {schema.schema_defined ? 'yes' : 'no'}
                          </Text>
                          <Text dimColor>Audit: {schema.audit ? 'yes' : 'no'}</Text>
                          <Text dimColor>
                            Attributes: {schema.attributes.map((a) => a.attribute).join(', ')}
                          </Text>
                        </>
                      );
                    })()}
                  </Box>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {loading && (
        <Box marginTop={1}>
          <Text dimColor>
            <Spinner type="dots" /> Refreshing...
          </Text>
        </Box>
      )}
    </Box>
  );
}

function DatabaseFilterInline({
  items,
  onDone,
  onCancel,
}: {
  items: string[];
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const filtered = useMemo(() => {
    if (!text) return items;
    const fuse = new Fuse(items, { threshold: 0.4 });
    return fuse.search(text).map((r) => r.item);
  }, [items, text]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [text]);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }
    if (key.return) {
      if (filtered.length > 0) {
        onDone(filtered[selectedIdx]);
      } else {
        onDone(text);
      }
      return;
    }
    if (key.downArrow) {
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (key.upArrow) {
      setSelectedIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (key.backspace) {
      setText((t) => t.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setText((t) => t + input);
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold>Filter: </Text>
        <Text>{text}</Text>
        <Text dimColor>|</Text>
      </Box>
      {filtered.slice(0, 5).map((item, i) => (
        <Text key={item} inverse={i === selectedIdx}>
          {i === selectedIdx ? '> ' : '  '}
          {item}
        </Text>
      ))}
    </Box>
  );
}
