import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { JsonTree, getLineKeyMap } from '../components/json-tree.js';
import { HarperClient } from '../api/client.js';
import type { RelationshipInfo } from '../relationships.js';

interface RecordScreenProps {
  record: Record<string, any>;
  database: string;
  table: string;
  primaryKey: string;
  client?: HarperClient;
  relationships?: RelationshipInfo[];
  onNavigateToRecord?: (database: string, table: string, record: Record<string, any>, primaryKey: string) => void;
}

function formatTimestamp(value: any): string {
  if (typeof value !== 'number') return String(value);
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function RecordScreen({
  record,
  database,
  table,
  primaryKey,
  client,
  relationships,
  onNavigateToRecord,
}: RecordScreenProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [selectedLine, setSelectedLine] = useState(0);
  const [copied, setCopied] = useState(false);
  const [fkError, setFkError] = useState<string | null>(null);

  const termHeight = process.stdout.rows || 24;
  const maxHeight = termHeight - 8; // Leave room for breadcrumb, status, key hints, reverse hints

  const displayRecord = useMemo(() => {
    const formatted = { ...record };
    if (formatted.__createdtime__) {
      formatted.__createdtime__ = formatTimestamp(formatted.__createdtime__);
    }
    if (formatted.__updatedtime__) {
      formatted.__updatedtime__ = formatTimestamp(formatted.__updatedtime__);
    }
    return formatted;
  }, [record]);

  // Estimate total lines for scroll bounds
  const totalLines = useMemo(() => {
    const json = JSON.stringify(displayRecord, null, 2);
    return json.split('\n').length;
  }, [displayRecord]);

  // Build FK annotation map from forward relationships
  const forwardRelMap = useMemo(() => {
    const map = new Map<string, RelationshipInfo>();
    if (!relationships) return map;
    for (const r of relationships) {
      if (r.direction === 'forward') {
        map.set(r.attribute, r);
      }
    }
    return map;
  }, [relationships]);

  const annotations = useMemo(() => {
    const ann: Record<string, string> = {};
    for (const [attr, rel] of forwardRelMap) {
      ann[attr] = `\u2192 ${rel.targetTable}`;
    }
    return ann;
  }, [forwardRelMap]);

  // Map line indices to top-level keys for FK detection
  const lineKeyMap = useMemo(() => getLineKeyMap(displayRecord), [displayRecord]);

  // Current selected key and whether it's a FK
  const selectedKey = lineKeyMap.get(selectedLine) ?? null;
  const selectedFk = selectedKey ? forwardRelMap.get(selectedKey) ?? null : null;

  // FK lookup state
  const [fkLoading, setFkLoading] = useState(false);

  // Reverse relationships
  const reverseRels = useMemo(() => {
    if (!relationships) return [];
    return relationships.filter((r) => r.direction === 'reverse');
  }, [relationships]);

  useInput((input, key) => {
    if (fkLoading) return;

    if (input === 'j' || key.downArrow) {
      setSelectedLine((l) => {
        const next = Math.min(l + 1, Math.max(0, totalLines - 1));
        // Auto-scroll to keep selected line visible
        if (next >= scrollOffset + maxHeight) {
          setScrollOffset(next - maxHeight + 1);
        }
        return next;
      });
      return;
    }
    if (input === 'k' || key.upArrow) {
      setSelectedLine((l) => {
        const next = Math.max(l - 1, 0);
        if (next < scrollOffset) {
          setScrollOffset(next);
        }
        return next;
      });
      return;
    }
    if (key.pageDown) {
      setSelectedLine((l) => {
        const next = Math.min(l + maxHeight, Math.max(0, totalLines - 1));
        setScrollOffset(Math.min(next, Math.max(0, totalLines - maxHeight)));
        return next;
      });
      return;
    }
    if (key.pageUp) {
      setSelectedLine((l) => {
        const next = Math.max(l - maxHeight, 0);
        setScrollOffset(Math.max(next, 0));
        return next;
      });
      return;
    }
    if (input === 'y') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      try {
        process.stdout.write('\x1b]52;c;' + btoa(JSON.stringify(record, null, 2)) + '\x07');
      } catch {
        // Silently fail
      }
      return;
    }
    // Enter: follow FK link
    if (key.return && selectedFk && client && onNavigateToRecord) {
      const fkValue = record[selectedFk.attribute];
      if (fkValue == null) {
        setFkError(`${selectedFk.attribute} is null`);
        setTimeout(() => setFkError(null), 2000);
        return;
      }
      setFkError(null);
      setFkLoading(true);
      client
        .searchById({
          database,
          table: selectedFk.targetTable,
          ids: [fkValue],
          getAttributes: ['*'],
        })
        .then((results) => {
          setFkLoading(false);
          if (!results || results.length === 0) {
            setFkError(`No record found in ${selectedFk.targetTable} for ${String(fkValue)}`);
            setTimeout(() => setFkError(null), 3000);
            return;
          }
          onNavigateToRecord(database, selectedFk.targetTable, results[0], 'id');
        })
        .catch((err) => {
          setFkLoading(false);
          setFkError(err?.message ?? 'Failed to load related record');
          setTimeout(() => setFkError(null), 3000);
        });
      return;
    }
  });

  const recordId = record[primaryKey] ?? 'unknown';

  return (
    <Box flexDirection="column" paddingX={1} >
      <Box marginBottom={1}>
        <Text bold>
          {database}.{table}
        </Text>
        <Text dimColor> / </Text>
        <Text bold color="cyan">
          {String(recordId)}
        </Text>
      </Box>

      <Box  flexDirection="column">
        <JsonTree
          data={displayRecord}
          scrollOffset={scrollOffset}
          maxHeight={maxHeight}
          annotations={Object.keys(annotations).length > 0 ? annotations : undefined}
          selectedLine={selectedLine}
        />
      </Box>

      {/* FK follow hint */}
      {selectedFk && (
        <Box>
          <Text dimColor>
            Enter: follow {selectedKey} {'\u2192'} {selectedFk.targetTable}
          </Text>
        </Box>
      )}

      {fkLoading && (
        <Box>
          <Text>
            <Spinner type="dots" /> Loading related record...
          </Text>
        </Box>
      )}

      {fkError && (
        <Box>
          <Text color="red">{fkError}</Text>
        </Box>
      )}

      {copied && (
        <Box>
          <Text color="green">Copied!</Text>
        </Box>
      )}

      {/* Reverse relationship hints */}
      {reverseRels.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text dimColor bold>Referenced by:</Text>
          {reverseRels.map((r, i) => (
            <Text key={i} dimColor>
              {'  '}{r.targetTable} (via {r.reverseAttribute})
            </Text>
          ))}
        </Box>
      )}

      {totalLines > maxHeight && (
        <Box>
          <Text dimColor>
            line {scrollOffset + 1}-{Math.min(scrollOffset + maxHeight, totalLines)} of{' '}
            {totalLines}
          </Text>
        </Box>
      )}
    </Box>
  );
}
