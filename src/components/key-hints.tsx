import React from 'react';
import { Box, Text } from 'ink';

interface Hint {
  key: string;
  label: string;
}

interface KeyHintsProps {
  hints: Hint[];
}

export function KeyHints({ hints }: KeyHintsProps) {
  return (
    <Box overflow="hidden">
      <Text wrap="truncate">
        {hints.map((h, i) => (i > 0 ? '  ' : '') + h.key + ': ' + h.label).join('')}
      </Text>
    </Box>
  );
}
