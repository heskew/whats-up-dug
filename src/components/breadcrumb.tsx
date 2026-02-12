import React from 'react';
import { Box, Text } from 'ink';

interface BreadcrumbProps {
  items: string[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <Box>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Box key={i}>
            {i > 0 && <Text dimColor> &gt; </Text>}
            <Text bold={isLast}>{item}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
