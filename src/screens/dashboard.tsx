import React, { useState, useEffect, useCallback, useMemo, type MutableRefObject } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import Fuse from 'fuse.js';
import { HarperClient } from '../api/client.js';
import { useApi } from '../hooks/use-api.js';
import type { TableSchema } from '../api/types.js';

interface DashboardScreenProps {
  client: HarperClient;
  url: string;
  onSelectDatabase: (db: string) => void;
  onSystemInfo: () => void;
  overlayActive?: MutableRefObject<boolean>;
}

interface DatabaseSummary {
  name: string;
  tableCount: number;
  totalRecords: number;
}

export function DashboardScreen({
  client,
  url,
  onSelectDatabase,
  onSystemInfo,
  overlayActive,
}: DashboardScreenProps) {
  const describeAll = useCallback(() => client.describeAll(), [client]);
  const { data, loading, error, queryTime, execute } = useApi(describeAll, true);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterText, setFilterText] = useState('');
  const [showFilter, setShowFilter] = useState(false);

  const databases: DatabaseSummary[] = useMemo(() => {
    if (!data) return [];
    return Object.entries(data).map(([name, tables]) => {
      const tableEntries = Object.values(tables) as TableSchema[];
      return {
        name,
        tableCount: tableEntries.length,
        totalRecords: tableEntries.reduce((sum, t) => sum + t.record_count, 0),
      };
    });
  }, [data]);

  const totalRecords = useMemo(
    () => databases.reduce((sum, db) => sum + db.totalRecords, 0),
    [databases],
  );

  const filteredDatabases = useMemo(() => {
    if (!filterText) return databases;
    const fuse = new Fuse(databases, { keys: ['name'], threshold: 0.4 });
    return fuse.search(filterText).map((r) => r.item);
  }, [databases, filterText]);

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
          Math.min(i + 1, filteredDatabases.length - 1),
        );
        return;
      }
      if (input === 'k' || key.upArrow) {
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (key.return && filteredDatabases.length > 0) {
        onSelectDatabase(filteredDatabases[selectedIndex].name);
        return;
      }
      if (input === 's') {
        onSystemInfo();
        return;
      }
      if (input === '/') {
        setShowFilter(true);
        return;
      }
      if (input === 'r') {
        client.clearCache();
        execute();
        return;
      }
    },
    { isActive: !loading },
  );

  const handleFilterSelect = useCallback(
    (item: string) => {
      setFilterText(item);
      setShowFilter(false);
    },
    [],
  );

  const handleFilterCancel = useCallback(() => {
    setFilterText('');
    setShowFilter(false);
  }, []);

  if (loading && !data) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Box>
          <Text>
            <Spinner type="dots" /> Sniffing around {url}...
          </Text>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingX={2} paddingY={1}>
        <Text color="red">{error}</Text>
        <Text dimColor>Press r to retry</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={2}>
      {/* Header */}
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold>Databases </Text>
          <Text color="yellow">(⊙.⊙)</Text>
        </Box>
        <Text dimColor>
          {databases.length} database{databases.length === 1 ? '' : 's'}  {'\u00b7'}  {totalRecords.toLocaleString()} total records  {'\u00b7'}  {queryTime}ms
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
          <FilterInline
            items={databases.map((d) => d.name)}
            onSelect={handleFilterSelect}
            onCancel={handleFilterCancel}
          />
        </Box>
      )}

      {/* Database list */}
      <Box flexDirection="column">
        {filteredDatabases.length === 0 && !loading ? (
          <Box flexDirection="column">
            <Text dimColor>  No databases found.</Text>
            <Text dimColor>  Create one in Harper Studio or via the Operations API.</Text>
          </Box>
        ) : (
          filteredDatabases.map((db, i) => {
            const selected = i === selectedIndex;
            return (
              <Box key={db.name} marginBottom={0}>
                <Text color={selected ? 'cyan' : undefined} bold={selected}>
                  {selected ? ' \u25b6 ' : '   '}
                </Text>
                <Text bold={selected} inverse={selected}>
                  {' '}{db.name}{' '}
                </Text>
                <Text dimColor>
                  {'  '}{db.tableCount} table{db.tableCount === 1 ? '' : 's'}
                  {'  \u00b7  '}{db.totalRecords.toLocaleString()} record{db.totalRecords === 1 ? '' : 's'}
                </Text>
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

// Inline filter component
function FilterInline({
  items,
  onSelect,
  onCancel,
}: {
  items: string[];
  onSelect: (item: string) => void;
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
    if (key.escape) { onCancel(); return; }
    if (key.return && filtered.length > 0) { onSelect(filtered[selectedIdx]); return; }
    if (key.downArrow) { setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1)); return; }
    if (key.upArrow) { setSelectedIdx((i) => Math.max(i - 1, 0)); return; }
    if (key.backspace) { setText((t) => t.slice(0, -1)); return; }
    if (input && !key.ctrl && !key.meta) { setText((t) => t + input); }
  });

  return (
    <Box flexDirection="column">
      <Box>
        <Text bold>/ </Text>
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
