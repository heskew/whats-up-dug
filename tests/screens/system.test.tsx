import React from 'react';
import { describe, test, expect, mock } from 'bun:test';
import { render } from 'ink-testing-library';
import { SystemScreen } from '../../src/screens/system.js';
import type { HarperClient } from '../../src/api/client.js';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function makeClient(overrides: Partial<HarperClient> = {}): HarperClient {
  return {
    systemInformation: mock(() =>
      Promise.resolve({
        system: {
          platform: 'linux',
          arch: 'x64',
          hostname: 'test-host',
          node_version: '20.0.0',
        },
        cpu: {
          brand: 'Test CPU',
          cores: 8,
          speed: 3.5,
          current_load: { currentLoad: 42.5 },
        },
        memory: {
          total: 16 * 1024 ** 3,
          active: 8 * 1024 ** 3,
          available: 8 * 1024 ** 3,
        },
        time: { uptime: 90061 }, // 1d 1h 1m
        threads: [{ id: 1 }, { id: 2 }],
      }),
    ),
    ...overrides,
  } as unknown as HarperClient;
}

describe('SystemScreen', () => {
  test('renders system info after loading', async () => {
    const client = makeClient();
    const { lastFrame } = render(<SystemScreen client={client} />);
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('System Information');
    expect(frame).toContain('v20.0.0');
    expect(frame).toContain('linux');
    expect(frame).toContain('test-host');
    expect(frame).toContain('Test CPU');
    expect(frame).toContain('8');
    expect(frame).toContain('3.5 GHz');
    expect(frame).toContain('42.5%');
    expect(frame).toContain('2 workers');
  });

  test('shows error state', async () => {
    const client = makeClient({
      systemInformation: mock(() => Promise.reject(new Error('connection lost'))),
    });
    const { lastFrame } = render(<SystemScreen client={client} />);
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('connection lost');
    expect(frame).toContain('Press r to retry');
  });

  test('formatUptime renders days, hours, minutes', async () => {
    const client = makeClient({
      systemInformation: mock(() =>
        Promise.resolve({
          system: { platform: 'linux' },
          time: { uptime: 90061 }, // 1d 1h 1m
        }),
      ),
    });
    const { lastFrame } = render(<SystemScreen client={client} />);
    await tick();
    expect(lastFrame()).toContain('1d 1h 1m');
  });

  test('formatBytes handles GB values', async () => {
    const client = makeClient({
      systemInformation: mock(() =>
        Promise.resolve({
          system: { platform: 'linux' },
          memory: { total: 2 * 1024 ** 3, active: 512 * 1024 ** 2, available: 1.5 * 1024 ** 3 },
        }),
      ),
    });
    const { lastFrame } = render(<SystemScreen client={client} />);
    await tick();
    const frame = lastFrame()!;
    expect(frame).toContain('2.0 GB');
    expect(frame).toContain('512.0 MB');
  });

  test('handles single worker thread', async () => {
    const client = makeClient({
      systemInformation: mock(() =>
        Promise.resolve({
          system: { platform: 'linux' },
          threads: [{ id: 1 }],
        }),
      ),
    });
    const { lastFrame } = render(<SystemScreen client={client} />);
    await tick();
    expect(lastFrame()).toContain('1 worker');
    expect(lastFrame()).not.toContain('workers');
  });
});
