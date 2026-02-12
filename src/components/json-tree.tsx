import React, { useMemo } from 'react';
import { Box, Text } from 'ink';

interface JsonTreeProps {
  data: any;
  scrollOffset?: number;
  maxHeight?: number;
  annotations?: Record<string, string>;
  selectedLine?: number;
}

interface LineSegment {
  text: string;
  color?: 'green' | 'yellow' | 'cyan' | 'dim' | 'bold';
}

interface RenderedLine {
  segments: LineSegment[];
  topLevelKey?: string;
}

function renderJson(value: any, indent: number, trackKeys?: boolean): RenderedLine[] {
  const lines: RenderedLine[] = [];
  const prefix = ' '.repeat(indent);

  if (value === null) {
    lines.push({ segments: [{ text: prefix }, { text: 'null', color: 'dim' }] });
    return lines;
  }

  if (typeof value === 'string') {
    lines.push({ segments: [{ text: prefix }, { text: `"${value}"`, color: 'green' }] });
    return lines;
  }

  if (typeof value === 'number') {
    lines.push({ segments: [{ text: prefix }, { text: String(value), color: 'yellow' }] });
    return lines;
  }

  if (typeof value === 'boolean') {
    lines.push({ segments: [{ text: prefix }, { text: String(value), color: 'cyan' }] });
    return lines;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push({ segments: [{ text: prefix }, { text: '[]' }] });
      return lines;
    }
    lines.push({ segments: [{ text: prefix }, { text: '[' }] });
    for (let i = 0; i < value.length; i++) {
      const childLines = renderJson(value[i], indent + 2);
      for (let j = 0; j < childLines.length; j++) {
        const segs = [...childLines[j].segments];
        if (j === childLines.length - 1 && i < value.length - 1) {
          segs.push({ text: ',' });
        }
        lines.push({ segments: segs });
      }
    }
    lines.push({ segments: [{ text: prefix }, { text: ']' }] });
    return lines;
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      lines.push({ segments: [{ text: prefix }, { text: '{}' }] });
      return lines;
    }
    lines.push({ segments: [{ text: prefix }, { text: '{' }] });
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const childLines = renderJson(value[k], indent + 2);
      if (childLines.length === 1) {
        // Inline key: value on one line
        const valSegments = childLines[0].segments.filter((s) => s.text.trim() !== '' || s.color);
        const segs: LineSegment[] = [
          { text: ' '.repeat(indent + 2) },
          { text: `"${k}"`, color: 'bold' },
          { text: ': ' },
          ...valSegments.map((s) => ({
            ...s,
            text: s.text.replace(/^[ ]+/, ''),
          })),
          ...(i < keys.length - 1 ? [{ text: ',' }] : []),
        ];
        lines.push({
          segments: segs,
          topLevelKey: trackKeys ? k : undefined,
        });
      } else {
        // Multi-line value — first line carries the key
        lines.push({
          segments: [
            { text: ' '.repeat(indent + 2) },
            { text: `"${k}"`, color: 'bold' },
            { text: ': ' },
            ...childLines[0].segments.filter((s) => s.text.trim() !== '').map((s) => ({
              ...s,
              text: s.text.replace(/^[ ]+/, ''),
            })),
          ],
          topLevelKey: trackKeys ? k : undefined,
        });
        for (let j = 1; j < childLines.length; j++) {
          const segs = [...childLines[j].segments];
          if (j === childLines.length - 1 && i < keys.length - 1) {
            segs.push({ text: ',' });
          }
          lines.push({ segments: segs });
        }
      }
    }
    lines.push({ segments: [{ text: prefix }, { text: '}' }] });
    return lines;
  }

  lines.push({ segments: [{ text: prefix }, { text: String(value) }] });
  return lines;
}

function Segment({ segment }: { segment: LineSegment }) {
  switch (segment.color) {
    case 'green':
      return <Text color="green">{segment.text}</Text>;
    case 'yellow':
      return <Text color="yellow">{segment.text}</Text>;
    case 'cyan':
      return <Text color="cyan">{segment.text}</Text>;
    case 'dim':
      return <Text dimColor>{segment.text}</Text>;
    case 'bold':
      return <Text bold>{segment.text}</Text>;
    default:
      return <Text>{segment.text}</Text>;
  }
}

export function JsonTree({ data, scrollOffset = 0, maxHeight, annotations, selectedLine }: JsonTreeProps) {
  const hasAnnotations = annotations && Object.keys(annotations).length > 0;
  const lines = useMemo(
    () => renderJson(data, 0, hasAnnotations || selectedLine != null),
    [data, hasAnnotations, selectedLine],
  );

  let visible = lines;
  if (maxHeight != null) {
    visible = lines.slice(scrollOffset, scrollOffset + maxHeight);
  }

  return (
    <Box flexDirection="column">
      {visible.map((line, i) => {
        const globalIndex = scrollOffset + i;
        const isSelected = selectedLine != null && globalIndex === selectedLine;
        const annotation =
          hasAnnotations && line.topLevelKey && annotations![line.topLevelKey];

        return (
          <Box key={i}>
            <Text inverse={isSelected}>
              {line.segments.map((seg, j) => (
                <Segment key={j} segment={seg} />
              ))}
            </Text>
            {annotation && (
              <Text dimColor color="magenta">
                {' '}{annotation}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}

/** Return line-index-to-top-level-key mapping for a given data object */
export function getLineKeyMap(data: any): Map<number, string> {
  const lines = renderJson(data, 0, true);
  const map = new Map<number, string>();
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].topLevelKey) {
      map.set(i, lines[i].topLevelKey!);
    }
  }
  return map;
}
