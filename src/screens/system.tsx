import React, { useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import Spinner from 'ink-spinner';
import { HarperClient } from '../api/client.js';
import { useApi } from '../hooks/use-api.js';
import type { SystemInfo } from '../api/types.js';

interface SystemScreenProps {
  client: HarperClient;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) {
    return (bytes / 1024 ** 3).toFixed(1) + ' GB';
  }
  if (bytes >= 1024 ** 2) {
    return (bytes / 1024 ** 2).toFixed(1) + ' MB';
  }
  if (bytes >= 1024) {
    return (bytes / 1024).toFixed(1) + ' KB';
  }
  return bytes + ' B';
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function SystemScreen({ client }: SystemScreenProps) {
  const fetchInfo = useCallback(() => client.systemInformation(), [client]);
  const { data, loading, error, queryTime, execute } = useApi<SystemInfo>(
    fetchInfo,
    true,
  );

  useInput((input) => {
    if (input === 'r') {
      execute();
    }
  });

  if (loading && !data) {
    return (
      <Box paddingX={1}>
        <Text>
          <Spinner type="dots" /> Loading system information...
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text color="red">{error}</Text>
        <Text dimColor>Press r to retry</Text>
      </Box>
    );
  }

  if (!data) return null;

  const sys = data.system;
  const cpu = data.cpu;
  const mem = data.memory;
  const time = data.time;
  const threads = data.threads;

  return (
    <Box flexDirection="column" paddingX={2}>
      <Box marginBottom={1} flexDirection="column">
        <Text bold>System Information</Text>
        <Text dimColor>{queryTime}ms</Text>
      </Box>

      <Box flexDirection="column">
        {/* System */}
        {sys?.node_version && (
          <InfoRow label="Node.js" value={`v${sys.node_version}`} />
        )}
        {sys?.platform && (
          <InfoRow
            label="Platform"
            value={`${sys.platform} (${sys.arch ?? ''})`}
          />
        )}
        {sys?.hostname && <InfoRow label="Hostname" value={sys.hostname} />}

        {/* CPU */}
        {cpu?.brand && <InfoRow label="CPU" value={cpu.brand} />}
        {cpu?.cores != null && (
          <InfoRow
            label="Cores"
            value={`${cpu.cores}${cpu.speed ? ` @ ${cpu.speed} GHz` : ''}`}
          />
        )}
        {cpu?.current_load?.currentLoad != null && (
          <InfoRow
            label="CPU Load"
            value={`${cpu.current_load.currentLoad.toFixed(1)}%`}
          />
        )}

        {/* Memory */}
        {mem?.total != null && (
          <InfoRow
            label="Memory"
            value={`${formatBytes(mem.active ?? mem.used ?? 0)} used / ${formatBytes(mem.total)} total (${formatBytes(mem.available ?? mem.free ?? 0)} available)`}
          />
        )}

        {/* Uptime */}
        {time?.uptime != null && (
          <InfoRow label="Uptime" value={formatUptime(time.uptime)} />
        )}

        {/* Threads */}
        {threads && threads.length > 0 && (
          <InfoRow label="Threads" value={`${threads.length} worker${threads.length === 1 ? '' : 's'}`} />
        )}
      </Box>

      {loading && (
        <Box marginTop={1}>
          <Text dimColor>
            <Spinner type="dots" /> Refreshing...
          </Text>
        </Box>
      )}

      <Box />
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Box width={20}>
        <Text bold>{label}</Text>
      </Box>
      <Text>{value}</Text>
    </Box>
  );
}
