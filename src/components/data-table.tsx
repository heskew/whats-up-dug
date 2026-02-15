import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { useTerminalSize } from '../hooks/use-terminal-size.js';

interface DataTableProps {
  data: Record<string, any>[];
  columns?: string[];
  selectedRow: number;
  page: number;
  totalPages?: number;
  colStart?: number;
  availableWidth?: number;
  onSelect?: (row: Record<string, any>) => void;
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '\u2026';
}

const TIMESTAMP_COLS = new Set(['__createdtime__', '__updatedtime__']);

export function padCell(str: string, width: number): string {
  const truncated = truncate(str, width);
  return truncated + ' '.repeat(Math.max(0, width - truncated.length));
}

export function formatCell(value: any, column: string): string {
  if (value === null || value === undefined) return '';
  if (TIMESTAMP_COLS.has(column) && typeof value === 'number') {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'object') return JSON.stringify(value);
  // Strip newlines so cells never span multiple visual lines
  return String(value).replace(/[\r\n]+/g, ' ');
}

export function DataTable({
  data,
  columns: columnsProp,
  selectedRow,
  page,
  totalPages,
  colStart = 0,
  availableWidth,
}: DataTableProps) {
  const allColumns = useMemo(() => {
    if (columnsProp && columnsProp.length > 0) return columnsProp;
    if (data.length === 0) return [];
    const keys = Object.keys(data[0]);
    const regular = keys.filter((k) => !k.startsWith('__'));
    const internal = keys.filter((k) => k.startsWith('__'));
    return [...regular, ...internal];
  }, [data, columnsProp]);

  const { columns: termWidth, tablePageSize: maxVisibleRows } = useTerminalSize();
  const effectiveWidth = availableWidth ?? termWidth;
  const COL_GAP = 2;
  const MAX_COL_WIDTH = 30;
  const MIN_COL_WIDTH = 8;
  const ROW_MARKER_WIDTH = 4; // "  ▶ "

  // Compute natural column widths from ALL page data (not just visible rows)
  // so there's no circular dependency with viewport calculation
  const naturalWidths = useMemo(() => {
    if (allColumns.length === 0) return [];

    return allColumns.map((col) => {
      let w = col.length;
      for (const row of data) {
        const cellLen = formatCell(row[col], col).length;
        if (cellLen > w) w = cellLen;
      }
      return Math.max(MIN_COL_WIDTH, Math.min(w, MAX_COL_WIDTH));
    });
  }, [allColumns, data]);

  // Horizontal windowing: pack columns starting from colStart until we fill the width
  const { columns, colWidths, hiddenLeft, hiddenRight } = useMemo(() => {
    if (allColumns.length === 0) return { columns: [], colWidths: [], hiddenLeft: 0, hiddenRight: 0 };

    // Compute max colStart: work backwards from the last column
    let maxStart = allColumns.length - 1;
    let budget = effectiveWidth - ROW_MARKER_WIDTH;
    for (let i = allColumns.length - 1; i >= 0; i--) {
      const w = naturalWidths[i];
      const needed = i < allColumns.length - 1 ? w + COL_GAP : w;
      if (budget < needed) break;
      budget -= needed;
      maxStart = i;
    }

    const clamped = Math.max(0, Math.min(colStart, maxStart));
    let available = effectiveWidth - ROW_MARKER_WIDTH;
    const visCols: string[] = [];
    const visWidths: number[] = [];

    for (let i = clamped; i < allColumns.length; i++) {
      const w = naturalWidths[i];
      const needed = visCols.length > 0 ? w + COL_GAP : w;
      if (available < needed) {
        if (visCols.length === 0) {
          visCols.push(allColumns[i]);
          visWidths.push(Math.max(MIN_COL_WIDTH, available));
        }
        break;
      }
      visCols.push(allColumns[i]);
      visWidths.push(w);
      available -= needed;
    }

    return {
      columns: visCols,
      colWidths: visWidths,
      hiddenLeft: clamped,
      hiddenRight: allColumns.length - clamped - visCols.length,
    };
  }, [allColumns, naturalWidths, colStart, effectiveWidth]);

  const hasColScroll = hiddenLeft > 0 || hiddenRight > 0;

  // Viewport window: keep selectedRow visible
  const { windowStart, windowEnd } = useMemo(() => {
    const total = data.length;
    const windowSize = Math.min(maxVisibleRows, total);

    let start = 0;
    if (selectedRow >= windowSize) {
      start = selectedRow - windowSize + 1;
    }
    start = Math.max(0, Math.min(start, total - windowSize));
    return { windowStart: start, windowEnd: start + windowSize };
  }, [data.length, selectedRow, maxVisibleRows]);

  const visibleData = useMemo(
    () => data.slice(windowStart, windowEnd),
    [data, windowStart, windowEnd],
  );

  if (data.length === 0) {
    return (
      <Box paddingY={1} paddingX={1}>
        <Text dimColor>I looked everywhere but couldn't find anything.</Text>
      </Box>
    );
  }

  const pad = (str: string, width: number) => padCell(str, width);

  const gap = ' '.repeat(COL_GAP);

  // Build full row strings to avoid Ink flex layout alignment quirks
  const buildRowStr = (cells: string[]) =>
    cells.map((cell, i) => (i > 0 ? gap : '') + cell).join('');

  const headerStr = buildRowStr(columns.map((col, i) => pad(col, colWidths[i])));
  const separatorStr = buildRowStr(colWidths.map((w) => '\u2500'.repeat(w)));

  return (
    <Box flexDirection="column">
      {/* Horizontal scroll indicator */}
      {hasColScroll && (
        <Box>
          <Text dimColor>
            {'    '}
            {hiddenLeft > 0 ? `\u2190 ${hiddenLeft} col${hiddenLeft === 1 ? '' : 's'}` : ''}
            {hiddenLeft > 0 && hiddenRight > 0 ? '  \u00b7  ' : ''}
            {hiddenRight > 0 ? `${hiddenRight} col${hiddenRight === 1 ? '' : 's'} \u2192` : ''}
            {'  (h/l)'}
          </Text>
        </Box>
      )}

      {/* Header */}
      <Box>
        <Text dimColor bold wrap="truncate">{'    '}{headerStr}</Text>
      </Box>

      {/* Separator */}
      <Box>
        <Text dimColor wrap="truncate">{'    '}{separatorStr}</Text>
      </Box>

      {/* Scroll indicator (top) */}
      {windowStart > 0 && (
        <Box>
          <Text dimColor>{'    \u2191 '}{windowStart}{' more above'}</Text>
        </Box>
      )}

      {/* Rows */}
      {visibleData.map((row, viewIdx) => {
        const rowIdx = windowStart + viewIdx;
        const isSelected = rowIdx === selectedRow;
        const rowStr = buildRowStr(
          columns.map((col, i) => pad(formatCell(row[col], col), colWidths[i])),
        );
        return (
          <Box key={rowIdx}>
            {isSelected ? (
              <Text wrap="truncate">
                <Text color="cyan" bold>{' \u25b6  '}</Text>
                <Text inverse>{rowStr}</Text>
              </Text>
            ) : (
              <Text wrap="truncate">{'    '}{rowStr}</Text>
            )}
          </Box>
        );
      })}

      {/* Scroll indicator (bottom) */}
      {windowEnd < data.length && (
        <Box>
          <Text dimColor>{'    \u2193 '}{data.length - windowEnd}{' more below'}</Text>
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
