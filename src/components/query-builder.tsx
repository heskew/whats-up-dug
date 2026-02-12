import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { Condition, SortSpec } from '../api/types.js';

const COMPARATORS = [
  'equals',
  'not_equal',
  'contains',
  'starts_with',
  'ends_with',
  'greater_than',
  'greater_than_equal',
  'less_than',
  'less_than_equal',
  'between',
] as const;

type EditField = 'attribute' | 'comparator' | 'value';
type Mode = 'list' | 'edit' | 'sort' | 'limit';

function coerceValue(v: string): string | number | boolean {
  if (v === 'true') return true;
  if (v === 'false') return false;
  const n = Number(v);
  if (v !== '' && !isNaN(n)) return n;
  return v;
}

interface QueryBuilderProps {
  attributes: string[];
  defaultLimit?: number;
  onExecute: (
    conditions: Condition[],
    operator: 'and' | 'or',
    sort?: SortSpec,
    limit?: number,
  ) => void;
  onCancel: () => void;
}

interface DraftCondition {
  attribute: string;
  comparator: string;
  value: string;
}

export function QueryBuilder({ attributes, defaultLimit, onExecute, onCancel }: QueryBuilderProps) {
  const [conditions, setConditions] = useState<DraftCondition[]>([]);
  const [operator, setOperator] = useState<'and' | 'or'>('and');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [mode, setMode] = useState<Mode>('list');
  const [editField, setEditField] = useState<EditField>('attribute');
  const [editValue, setEditValue] = useState('');
  const [editIdx, setEditIdx] = useState(-1);
  const [sortAttr, setSortAttr] = useState('');
  const [sortDesc, setSortDesc] = useState(false);
  const [limit, setLimit] = useState(String(defaultLimit ?? 25));

  // Items: conditions + [+ Add condition]
  const listLength = conditions.length + 1;

  const attrSuggestions = useMemo(() => {
    if (mode !== 'edit' || editField !== 'attribute' || !editValue) return [];
    const lower = editValue.toLowerCase();
    return attributes.filter((a) => a.toLowerCase().includes(lower)).slice(0, 5);
  }, [mode, editField, editValue, attributes]);

  const comparatorSuggestions = useMemo(() => {
    if (mode !== 'edit' || editField !== 'comparator' || !editValue) return [...COMPARATORS];
    const lower = editValue.toLowerCase();
    return COMPARATORS.filter((c) => c.includes(lower));
  }, [mode, editField, editValue]);

  useInput((input, key) => {
    if (mode === 'list') {
      if (key.escape) {
        onCancel();
        return;
      }
      if (key.upArrow) {
        setSelectedIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIdx((i) => Math.min(listLength - 1, i + 1));
        return;
      }
      if (input === 'a' || (key.return && selectedIdx === conditions.length)) {
        // Add new condition
        const idx = conditions.length;
        setConditions([...conditions, { attribute: '', comparator: 'equals', value: '' }]);
        setEditIdx(idx);
        setEditField('attribute');
        setEditValue('');
        setMode('edit');
        return;
      }
      if (input === 'd' && conditions.length > 0 && selectedIdx < conditions.length) {
        const next = [...conditions];
        next.splice(selectedIdx, 1);
        setConditions(next);
        setSelectedIdx(Math.min(selectedIdx, Math.max(0, next.length)));
        return;
      }
      if (key.return && selectedIdx < conditions.length) {
        setEditIdx(selectedIdx);
        setEditField('attribute');
        setEditValue(conditions[selectedIdx].attribute);
        setMode('edit');
        return;
      }
      if (key.tab) {
        setOperator((o) => (o === 'and' ? 'or' : 'and'));
        return;
      }
      if (input === 'x') {
        const parsed: Condition[] = conditions
          .filter((c) => c.attribute && c.value)
          .map((c) => ({
            attribute: c.attribute,
            comparator: c.comparator as any,
            value: c.comparator === 'between'
              ? c.value.split(',').map((v) => coerceValue(v.trim()))
              : coerceValue(c.value),
          }));
        const sort: SortSpec | undefined = sortAttr
          ? { attribute: sortAttr, descending: sortDesc }
          : undefined;
        const lim = parseInt(limit, 10);
        onExecute(parsed, operator, sort, isNaN(lim) ? (defaultLimit ?? 25) : lim);
        return;
      }
      if (input === 's') {
        setMode('sort');
        setEditValue(sortAttr);
        return;
      }
      if (input === 'l') {
        setMode('limit');
        setEditValue(limit);
        return;
      }
      return;
    }

    if (mode === 'edit') {
      if (key.escape) {
        // Cancel edit, remove if empty
        if (!conditions[editIdx].attribute && !conditions[editIdx].value) {
          const next = [...conditions];
          next.splice(editIdx, 1);
          setConditions(next);
        }
        setMode('list');
        return;
      }
      if (key.return) {
        const updated = [...conditions];
        if (editField === 'attribute') {
          updated[editIdx] = { ...updated[editIdx], attribute: editValue };
          setConditions(updated);
          setEditField('comparator');
          setEditValue(updated[editIdx].comparator);
        } else if (editField === 'comparator') {
          updated[editIdx] = { ...updated[editIdx], comparator: editValue || 'equals' };
          setConditions(updated);
          setEditField('value');
          setEditValue(updated[editIdx].value);
        } else {
          updated[editIdx] = { ...updated[editIdx], value: editValue };
          setConditions(updated);
          setMode('list');
          setSelectedIdx(editIdx);
        }
        return;
      }
      if (key.tab && editField === 'attribute' && attrSuggestions.length > 0) {
        setEditValue(attrSuggestions[0]);
        return;
      }
      if (key.tab && editField === 'comparator' && comparatorSuggestions.length > 0) {
        setEditValue(comparatorSuggestions[0]);
        return;
      }
      return;
    }

    if (mode === 'sort') {
      if (key.escape) {
        setMode('list');
        return;
      }
      if (key.return) {
        setSortAttr(editValue);
        setMode('list');
        return;
      }
      if (key.tab) {
        setSortDesc((d) => !d);
        return;
      }
      return;
    }

    if (mode === 'limit') {
      if (key.escape) {
        setMode('list');
        return;
      }
      if (key.return) {
        setLimit(editValue || String(defaultLimit ?? 25));
        setMode('list');
        return;
      }
      return;
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold>Query Builder</Text>
        <Text dimColor>  operator: </Text>
        <Text bold color={operator === 'and' ? 'cyan' : 'magenta'}>
          {operator.toUpperCase()}
        </Text>
        <Text dimColor>  (Tab to toggle)</Text>
      </Box>

      {/* Conditions list */}
      {conditions.map((c, i) => {
        const isSelected = mode === 'list' && i === selectedIdx;
        const isEditing = mode === 'edit' && i === editIdx;
        return (
          <Box key={i}>
            <Text inverse={isSelected}>
              {isSelected ? '> ' : '  '}
              {isEditing ? '' : `${c.attribute || '?'} ${c.comparator} ${c.value || '?'}`}
            </Text>
            {isEditing && (
              <Box>
                <Text dimColor>{editField}: </Text>
                <TextInput value={editValue} onChange={setEditValue} />
                {editField === 'attribute' && attrSuggestions.length > 0 && (
                  <Text dimColor> (Tab: {attrSuggestions[0]})</Text>
                )}
                {editField === 'comparator' && comparatorSuggestions.length > 0 && (
                  <Text dimColor> (Tab: {comparatorSuggestions[0]})</Text>
                )}
              </Box>
            )}
          </Box>
        );
      })}

      {/* Add condition option */}
      <Box>
        <Text
          inverse={mode === 'list' && selectedIdx === conditions.length}
          color="green"
        >
          {mode === 'list' && selectedIdx === conditions.length ? '> ' : '  '}
          [+ Add condition]
        </Text>
      </Box>

      {/* Sort edit */}
      {mode === 'sort' && (
        <Box marginTop={1}>
          <Text dimColor>Sort by: </Text>
          <TextInput value={editValue} onChange={setEditValue} />
          <Text dimColor>  {sortDesc ? 'DESC' : 'ASC'} (Tab to toggle)</Text>
        </Box>
      )}

      {/* Limit edit */}
      {mode === 'limit' && (
        <Box marginTop={1}>
          <Text dimColor>Limit: </Text>
          <TextInput value={editValue} onChange={setEditValue} />
        </Box>
      )}

      {/* Status line */}
      <Box marginTop={1}>
        <Text dimColor>
          {sortAttr ? `sort: ${sortAttr} ${sortDesc ? 'DESC' : 'ASC'}` : 'sort: none'}
          {'  '}limit: {limit}
        </Text>
      </Box>

      {/* Key hints */}
      <Box marginTop={1}>
        <Text bold>x</Text><Text dimColor>: execute  </Text>
        <Text bold>a</Text><Text dimColor>: add  </Text>
        <Text bold>d</Text><Text dimColor>: delete  </Text>
        <Text bold>s</Text><Text dimColor>: sort  </Text>
        <Text bold>l</Text><Text dimColor>: limit  </Text>
        <Text bold>Esc</Text><Text dimColor>: cancel</Text>
      </Box>
    </Box>
  );
}
