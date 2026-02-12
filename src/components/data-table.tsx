import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTerminalSize } from '../hooks/use-terminal-size.js';

interface DataTableProps {
  data: Record<string, any>[];
  columns?: string[];
  selectedRow: number;
  page: number;
  totalPages?: number;
  onSelect?: (row: Record<string, any>) => void;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '\u2026';
}

const TIMESTAMP_COLS = new Set(['__createdtime__', '__updatedtime__']);

function formatCell(value: any, column: string): string {
  if (value === null || value === undefined) return '';
  if (TIMESTAMP_COLS.has(column) && typeof value === 'number') {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function DataTable({
  data,
  columns: columnsProp,
  selectedRow,
  page,
  totalPages,
}: DataTableProps) {
  const columns = useMemo(() => {
    if (columnsProp && columnsProp.length > 0) return columnsProp;
    if (data.length === 0) return [];
    const keys = Object.keys(data[0]);
    const regular = keys.filter((k) => !k.startsWith('__'));
    const internal = keys.filter((k) => k.startsWith('__'));
    return [...regular, ...internal];
  }, [data, columnsProp]);

  const { columns: termWidth, tablePageSize: maxVisibleRows } = useTerminalSize();
  const COL_GAP = 2; // spaces between columns

  // Viewport window: keep selectedRow visible
  const { windowStart, windowEnd } = useMemo(() => {
    const total = data.length;
    const windowSize = Math.min(maxVisibleRows, total);

    let start = 0;
    if (selectedRow >= windowSize) {
      // Scroll so selectedRow is near the bottom of the window
      start = selectedRow - windowSize + 1;
    }
    // Clamp
    start = Math.max(0, Math.min(start, total - windowSize));
    return { windowStart: start, windowEnd: start + windowSize };
  }, [data.length, selectedRow, maxVisibleRows]);

  const visibleData = useMemo(
    () => data.slice(windowStart, windowEnd),
    [data, windowStart, windowEnd],
  );

  const colWidths = useMemo(() => {
    if (columns.length === 0) return [];

    const widths = columns.map((col) => col.length);
    // Only measure visible rows for column widths (performance)
    for (const row of visibleData) {
      for (let i = 0; i < columns.length; i++) {
        const cellLen = formatCell(row[columns[i]], columns[i]).length;
        if (cellLen > widths[i]) widths[i] = cellLen;
      }
    }

    // 4 chars for row marker "  > ", then COL_GAP between each column
    const available = termWidth - 4 - COL_GAP * (columns.length - 1);
    const maxPerCol = Math.max(8, Math.floor(available / columns.length));

    return widths.map((w) => Math.min(w, maxPerCol));
  }, [columns, visibleData, termWidth]);

  if (data.length === 0) {
    return (
      <Box paddingY={1} paddingX={1}>
        <Text dimColor>I looked everywhere but couldn't find anything.</Text>
      </Box>
    );
  }

  const pad = (str: string, width: number) => {
    const truncated = truncate(str, width);
    return truncated + ' '.repeat(Math.max(0, width - truncated.length));
  };

  const gap = ' '.repeat(COL_GAP);

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box>
        <Text dimColor>{'    '}</Text>
        {columns.map((col, i) => (
          <Text key={col} dimColor bold>
            {i > 0 ? gap : ''}{pad(col, colWidths[i])}
          </Text>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        <Text dimColor>
          {'    '}{columns.map((_, i) => '\u2500'.repeat(colWidths[i])).join(gap)}
        </Text>
      </Box>

      {/* Scroll indicator (top) */}
      {windowStart > 0 && (
        <Box>
          <Text dimColor>    \u2191 {windowStart} more above</Text>
        </Box>
      )}

      {/* Rows (viewport clipped) */}
      {visibleData.map((row, viewIdx) => {
        const rowIdx = windowStart + viewIdx;
        const isSelected = rowIdx === selectedRow;
        return (
          <Box key={rowIdx}>
            <Text color={isSelected ? 'cyan' : undefined} bold={isSelected}>
              {isSelected ? ' \u25b6  ' : '    '}
            </Text>
            {columns.map((col, i) => (
              <Text key={col} inverse={isSelected}>
                {i > 0 ? gap : ''}{pad(formatCell(row[col], col), colWidths[i])}
              </Text>
            ))}
          </Box>
        );
      })}

      {/* Scroll indicator (bottom) */}
      {windowEnd < data.length && (
        <Box>
          <Text dimColor>    \u2193 {data.length - windowEnd} more below</Text>
        </Box>
      )}

      {/* Page indicator */}
      {totalPages != null && totalPages > 1 && (
        <Box marginTop={1}>
          <Text dimColor>
            {'    '}page {page + 1}/{totalPages}  {'\u00b7'}  row {selectedRow + 1}/{data.length}
          </Text>
        </Box>
      )}
    </Box>
  );
}
