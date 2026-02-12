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
    <Box>
      {hints.map((hint, i) => (
        <Box key={i}>
          {i > 0 && <Text>  </Text>}
          <Text bold>{hint.key}</Text>
          <Text dimColor>: {hint.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
