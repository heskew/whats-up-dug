import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { HarperClient } from './api/client.js';
import { useNavigation, type ScreenName } from './hooks/use-navigation.js';
import { Breadcrumb } from './components/breadcrumb.js';
import { KeyHints } from './components/key-hints.js';
import { app as appLog, nav as navLog } from './logger.js';
import { ConnectScreen } from './screens/connect.js';
import { DashboardScreen } from './screens/dashboard.js';
import { DatabaseScreen } from './screens/database.js';
import { TableScreen } from './screens/table.js';
import { RecordScreen } from './screens/record.js';
import { SystemScreen } from './screens/system.js';
import { inferRelationships } from './relationships.js';
import { useApi } from './hooks/use-api.js';
import { useTerminalSize } from './hooks/use-terminal-size.js';
import type { TableSchema } from './api/types.js';

interface AppProps {
  client: HarperClient;
  initialScreen: ScreenName;
  initialUrl?: string;
  initialUser?: string;
  initialPassword?: string;
}

export function App({
  client,
  initialScreen,
  initialUrl,
  initialUser,
  initialPassword,
}: AppProps) {
  const { current, stack, push, pop } = useNavigation(initialScreen);
  const { exit } = useApp();
  const { rows: terminalRows } = useTerminalSize();
  const [quitting, setQuitting] = useState(false);
  const [qPending, setQPending] = useState(false);
  const [connectedUrl, setConnectedUrl] = useState(initialUrl ?? '');

  // Grace period: ignore stale keystrokes from previous session
  const ready = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { ready.current = true; }, 150);
    return () => clearTimeout(t);
  }, []);

  // Screens set this to true when they have an active overlay (e.g. column picker)
  // so that global Escape doesn't pop navigation
  const overlayActive = useRef(false);

  // Clear screen before navigation so stale output from taller screens doesn't linger.
  // Called synchronously before state changes — Ink's next render starts from row 0.
  const { stdout } = useStdout();
  const clearScreen = useCallback(() => {
    stdout.write('\x1b[2J\x1b[H');
  }, [stdout]);

  // Screens with text inputs where single-char keys should be suppressed
  const hasTextInput = current.screen === 'connect';

  // Global key handling
  useInput(
    (input, key) => {
      if (quitting) return;
      if (!ready.current) return; // ignore stale input on startup

      // Quit: press q twice (first press shows hint, second confirms)
      if (!hasTextInput && input === 'q') {
        if (qPending) {
          setQuitting(true);
          setTimeout(() => exit(), 500);
        } else {
          setQPending(true);
          setTimeout(() => setQPending(false), 2000);
        }
        return;
      }
      // Any other key clears the quit hint
      if (qPending) {
        setQPending(false);
      }
      // Escape: navigate back, or quit from connect screen
      if (key.escape && !overlayActive.current) {
        if (stack.length > 1) {
          clearScreen();
          pop();
        } else {
          setQuitting(true);
          setTimeout(() => exit(), 500);
        }
        return;
      }
    },
    { isActive: true },
  );

  // Navigation callbacks
  const handleConnect = useCallback(
    (url: string) => {
      navLog.info('Connected, navigating to dashboard');
      client.clearCache();
      setConnectedUrl(url);
      clearScreen();
      push('dashboard', { url });
    },
    [push, client, clearScreen],
  );

  const handleSelectDatabase = useCallback(
    (db: string) => {
      navLog.info('Selected database: %s', db);
      clearScreen();
      push('database', { database: db });
    },
    [push, clearScreen],
  );

  const handleSelectTable = useCallback(
    (table: string) => {
      const db = current.params.database;
      navLog.info('Selected table: %s.%s', db, table);
      clearScreen();
      push('table', { database: db, table });
    },
    [push, current, clearScreen],
  );

  const handleSelectRecord = useCallback(
    (record: Record<string, any>, primaryKey?: string) => {
      const { database, table } = current.params;
      const pk = primaryKey ?? 'id';
      navLog.info('Selected record: %s.%s[%s]', database, table, record[pk]);
      clearScreen();
      push('record', { database, table, record, primaryKey: pk });
    },
    [push, current, clearScreen],
  );

  const handleNavigateToRecord = useCallback(
    (database: string, table: string, record: Record<string, any>, primaryKey: string) => {
      navLog.info('FK navigate: %s.%s[%s]', database, table, record[primaryKey] ?? '?');
      clearScreen();
      push('record', { database, table, record, primaryKey });
    },
    [push, clearScreen],
  );

  const handleSystemInfo = useCallback(() => {
    navLog.info('Viewing system info');
    clearScreen();
    push('system', {});
  }, [push, clearScreen]);

  // Build breadcrumb from current screen only (cleaner than traversing full stack)
  const breadcrumbItems = useMemo(() => {
    const items: string[] = ['dug \u{1F415}'];
    if (connectedUrl) {
      try {
        const u = new URL(connectedUrl);
        items.push(u.hostname);
      } catch {
        items.push(connectedUrl);
      }
    }

    switch (current.screen) {
      case 'connect':
        break;
      case 'dashboard':
        break;
      case 'database':
        items.push(current.params.database ?? 'database');
        break;
      case 'table':
        items.push(current.params.database ?? 'db');
        items.push(current.params.table ?? 'table');
        break;
      case 'record': {
        items.push(current.params.database ?? 'db');
        items.push(current.params.table ?? 'table');
        const pk =
          current.params.record?.[current.params.primaryKey] ??
          current.params.record?.id ??
          'record';
        items.push(String(pk));
        break;
      }
      case 'system':
        items.push('system');
        break;
    }
    return items;
  }, [current, connectedUrl]);

  // Key hints vary by screen
  const hints = useMemo(() => {
    const common = [{ key: 'q', label: 'quit' }];
    const back =
      stack.length > 1 ? [{ key: 'Esc', label: 'back' }] : [];

    switch (current.screen) {
      case 'connect':
        return [
          { key: 'Tab', label: 'next field' },
          { key: 'Enter', label: 'connect' },
          { key: 'Esc', label: 'quit' },
        ];
      case 'dashboard':
        return [
          { key: 'j/k', label: 'navigate' },
          { key: 'Enter', label: 'select' },
          { key: '/', label: 'filter' },
          { key: 's', label: 'system' },
          { key: 'r', label: 'refresh' },
          ...back,
          ...common,
        ];
      case 'database':
        return [
          { key: 'j/k', label: 'navigate' },
          { key: 'Enter', label: 'select' },
          { key: '/', label: 'filter' },
          { key: 'i', label: 'info' },
          { key: 'r', label: 'refresh' },
          ...back,
          ...common,
        ];
      case 'table':
        return [
          { key: 'j/k', label: 'navigate' },
          { key: 'h/l', label: 'scroll cols' },
          { key: 'Enter', label: 'view' },
          { key: 'n/p', label: 'page' },
          { key: '/', label: 'search' },
          { key: 'f', label: 'query' },
          { key: 'c', label: 'columns' },
          { key: 's', label: 'sort' },
          { key: 'i', label: 'schema' },
          { key: 'r', label: 'refresh' },
          ...back,
          ...common,
        ];
      case 'record':
        return [
          { key: 'j/k', label: 'scroll' },
          { key: 'Enter', label: 'follow link' },
          { key: 'y', label: 'copy' },
          ...back,
          ...common,
        ];
      case 'system':
        return [{ key: 'r', label: 'refresh' }, ...back, ...common];
      default:
        return [...back, ...common];
    }
  }, [current.screen, stack.length]);

  // Fetch database schema for relationship inference on record screens
  const recordDb = current.screen === 'record' ? (current.params.database ?? '') : '';
  const recordTable = current.screen === 'record' ? (current.params.table ?? '') : '';
  const describeDbForRecord = useCallback(
    () => {
      if (!recordDb) return Promise.resolve({} as Record<string, TableSchema>);
      return client.describeDatabase(recordDb);
    },
    [client, recordDb],
  );
  const { data: recordDbSchema } = useApi<Record<string, TableSchema>>(
    describeDbForRecord,
    current.screen === 'record' && !!recordDb,
  );

  // Compute relationships for the current record's table
  const recordRelationships = useMemo(() => {
    if (!recordDbSchema || !recordTable || !recordDbSchema[recordTable]) return [];
    return inferRelationships(recordTable, recordDbSchema[recordTable], recordDbSchema);
  }, [recordTable, recordDbSchema]);

  if (quitting) {
    return (
      <Box paddingX={1} paddingY={1}>
        <Text bold color="magenta">
          Bye! I will miss you!
        </Text>
      </Box>
    );
  }

  // Render current screen
  const renderScreen = () => {
    switch (current.screen) {
      case 'connect':
        return (
          <ConnectScreen
            client={client}
            onConnect={handleConnect}
            initialUrl={initialUrl}
            initialUser={initialUser}
            initialPassword={initialPassword}
          />
        );
      case 'dashboard':
        return (
          <DashboardScreen
            client={client}
            url={connectedUrl}
            onSelectDatabase={handleSelectDatabase}
            onSystemInfo={handleSystemInfo}
            overlayActive={overlayActive}
          />
        );
      case 'database':
        return (
          <DatabaseScreen
            client={client}
            database={current.params.database}
            onSelectTable={handleSelectTable}
            overlayActive={overlayActive}
          />
        );
      case 'table':
        return (
          <TableScreen
            client={client}
            database={current.params.database}
            table={current.params.table}
            onSelectRecord={handleSelectRecord}
            overlayActive={overlayActive}
          />
        );
      case 'record': {
        // Find the primary key from the table screen's params in the stack
        const tableEntry = [...stack].reverse().find(
          (e) => e.screen === 'table',
        );
        const db = current.params.database ?? tableEntry?.params.database ?? '';
        const tbl = current.params.table ?? tableEntry?.params.table ?? '';
        return (
          <RecordScreen
            record={current.params.record}
            database={db}
            table={tbl}
            primaryKey={
              current.params.primaryKey ?? 'id'
            }
            client={client}
            relationships={recordRelationships}
            onNavigateToRecord={handleNavigateToRecord}
          />
        );
      }
      case 'system':
        return <SystemScreen client={client} />;
      default:
        return <Text color="red">Unknown screen: {current.screen}</Text>;
    }
  };

  return (
    <Box flexDirection="column" height={terminalRows}>
      {/* Top: Breadcrumb */}
      <Box paddingX={1} marginBottom={1}>
        <Breadcrumb items={breadcrumbItems} />
      </Box>

      {/* Middle: Screen content */}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} overflow="hidden">
        {renderScreen()}
      </Box>

      {/* Bottom: Key hints + quit hint */}
      <Box flexShrink={0} paddingX={1} marginTop={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} overflow="hidden">
        {qPending ? (
          <Text color="yellow" wrap="truncate">Press q again to quit</Text>
        ) : (
          <KeyHints hints={hints} />
        )}
      </Box>
    </Box>
  );
}
