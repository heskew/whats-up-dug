import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { HarperClient } from '../api/client.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

interface ConnectScreenProps {
  client: HarperClient;
  onConnect: (url: string) => void;
  initialUrl?: string;
  initialUser?: string;
  initialPassword?: string;
}

interface SavedConnection {
  url: string;
  username: string;
}

const CONNECTIONS_PATH = join(homedir(), '.dug', 'connections.json');

async function loadConnections(): Promise<SavedConnection[]> {
  try {
    const raw = await readFile(CONNECTIONS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveConnection(url: string, username: string): Promise<void> {
  try {
    const existing = await loadConnections();
    const filtered = existing.filter(
      (c) => !(c.url === url && c.username === username),
    );
    filtered.unshift({ url, username });
    const trimmed = filtered.slice(0, 10);
    await mkdir(join(homedir(), '.dug'), { recursive: true });
    await writeFile(CONNECTIONS_PATH, JSON.stringify(trimmed, null, 2));
  } catch {
    // Silently ignore save errors
  }
}

const TAGLINE = Math.random() < 0.1
  ? 'SQUIRREL!!!'
  : 'I have just met your data and I LOVE it!';


const DEFAULT_URL = 'http://localhost:9925';
const DEFAULT_USER = 'HDB_ADMIN';

export function ConnectScreen({
  client,
  onConnect,
  initialUrl = '',
  initialUser = '',
  initialPassword = '',
}: ConnectScreenProps) {
  const [url, setUrl] = useState(initialUrl);
  const [username, setUsername] = useState(initialUser);
  const [password, setPassword] = useState(initialPassword);
  const [activeField, setActiveField] = useState<0 | 1 | 2>(
    initialUrl ? (initialUser ? 2 : 1) : 0,
  );
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentConnections, setRecentConnections] = useState<SavedConnection[]>(
    [],
  );
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    loadConnections().then((conns) => {
      setRecentConnections(conns);
      setLoaded(true);
    });
  }, []);

  const handleConnect = useCallback(async () => {
    const finalUrl = url.trim() || DEFAULT_URL;
    const finalUser = username.trim() || DEFAULT_USER;
    if (!finalUrl || !finalUser || !password.trim()) return;
    setUrl(finalUrl);
    setUsername(finalUser);
    setConnecting(true);
    setError(null);
    try {
      await client.connect(finalUrl, finalUser, password.trim());
      await saveConnection(finalUrl, finalUser);
      onConnect(finalUrl);
    } catch (err: any) {
      setError(
        err?.message || 'I cannot smell the server. Is it running?',
      );
    } finally {
      setConnecting(false);
    }
  }, [url, username, password, client, onConnect]);

  useInput(
    (input, key) => {
      if (connecting) return;

      if (key.return) {
        if (activeField === 0) {
          if (!url.trim()) setUrl(DEFAULT_URL);
          setActiveField(1);
        } else if (activeField === 1) {
          if (!username.trim()) setUsername(DEFAULT_USER);
          setActiveField(2);
        } else {
          handleConnect();
        }
        return;
      }

      if (key.tab) {
        if (key.shift) {
          setActiveField(
            (activeField === 0 ? 2 : activeField - 1) as 0 | 1 | 2,
          );
        } else {
          // Fill default when tabbing forward past an empty field
          if (activeField === 0 && !url.trim()) setUrl(DEFAULT_URL);
          if (activeField === 1 && !username.trim()) setUsername(DEFAULT_USER);
          setActiveField(((activeField + 1) % 3) as 0 | 1 | 2);
        }
        return;
      }

      // Quick-select recent connection by number
      if (
        activeField === 0 &&
        !url &&
        input >= '1' &&
        input <= '9'
      ) {
        const idx = parseInt(input) - 1;
        if (idx < recentConnections.length) {
          const conn = recentConnections[idx];
          setUrl(conn.url);
          setUsername(conn.username);
          setActiveField(2);
        }
      }
    },
    { isActive: !connecting },
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1} flexDirection="column">
        <Text bold color="magenta">{TAGLINE}</Text>
      </Box>

      {/* Recent connections */}
      {loaded && recentConnections.length > 0 && !url && (
        <Box flexDirection="column" marginBottom={1}>
          <Text dimColor>Recent connections:</Text>
          {recentConnections.slice(0, 5).map((conn, i) => (
            <Text key={i} dimColor>
              {' '}
              {i + 1}. {conn.username}@{conn.url}
            </Text>
          ))}
        </Box>
      )}

      {/* URL field */}
      <Box>
        <Text bold={activeField === 0}>Instance URL: </Text>
        {activeField === 0 ? (
          <TextInput
            value={url}
            onChange={setUrl}
            placeholder="http://localhost:9925"
          />
        ) : (
          <Text>{url || <Text dimColor>http://localhost:9925</Text>}</Text>
        )}
      </Box>

      {/* Username field */}
      <Box>
        <Text bold={activeField === 1}>Username: </Text>
        {activeField === 1 ? (
          <TextInput
            value={username}
            onChange={setUsername}
            placeholder="HDB_ADMIN"
          />
        ) : (
          <Text>{username || <Text dimColor>HDB_ADMIN</Text>}</Text>
        )}
      </Box>

      {/* Password field */}
      <Box>
        <Text bold={activeField === 2}>Password: </Text>
        {activeField === 2 ? (
          <TextInput
            value={password}
            onChange={setPassword}
            placeholder="password"
            mask="*"
          />
        ) : (
          <Text>{'*'.repeat(password.length)}</Text>
        )}
      </Box>

      <Box marginTop={1}>
        {connecting ? (
          <Text>
            <Spinner type="dots" /> Connecting...
          </Text>
        ) : (
          <Text dimColor>
            Tab/Enter to advance (accepts defaults), Enter on password to connect
          </Text>
        )}
      </Box>

      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
    </Box>
  );
}
