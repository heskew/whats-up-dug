import { useState, useEffect } from 'react';

// Lines reserved for chrome: breadcrumb (1) + margin (1) + screen header (2) +
// table header/separator (2) + page indicator (2) + key hints footer (2) + margins (2)
const RESERVED_LINES = 12;

function getSize() {
  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;
  return {
    columns: cols,
    rows: rows,
    tablePageSize: Math.max(5, rows - RESERVED_LINES),
  };
}

export function useTerminalSize() {
  const [size, setSize] = useState(getSize);

  useEffect(() => {
    const onResize = () => setSize(getSize());
    process.stdout.on('resize', onResize);
    return () => {
      process.stdout.off('resize', onResize);
    };
  }, []);

  return size;
}
