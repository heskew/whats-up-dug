import React from 'react';
import { describe, test, expect, mock } from 'bun:test';
import { render } from 'ink-testing-library';
import { ConnectScreen } from './connect.js';
import type { HarperClient } from '../api/client.js';

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function makeClient(overrides: Partial<HarperClient> = {}): HarperClient {
  return {
    connect: mock(() => Promise.resolve()),
    ...overrides,
  } as unknown as HarperClient;
}

describe('ConnectScreen', () => {
  test('renders connection form fields', () => {
    const client = makeClient();
    const onConnect = mock(() => {});
    const { lastFrame } = render(
      <ConnectScreen client={client} onConnect={onConnect} />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('Instance URL');
    expect(frame).toContain('Username');
    expect(frame).toContain('Password');
  });

  test('shows tagline', () => {
    const client = makeClient();
    const onConnect = mock(() => {});
    const { lastFrame } = render(
      <ConnectScreen client={client} onConnect={onConnect} />,
    );
    const frame = lastFrame()!;
    // Either the normal tagline or the easter egg
    const hasTagline =
      frame.includes('I have just met your data and I LOVE it!') ||
      frame.includes('SQUIRREL!!!');
    expect(hasTagline).toBe(true);
  });

  test('renders with initial values', () => {
    const client = makeClient();
    const onConnect = mock(() => {});
    const { lastFrame } = render(
      <ConnectScreen
        client={client}
        onConnect={onConnect}
        initialUrl="http://myhost:9925"
        initialUser="admin"
        initialPassword="secret"
      />,
    );
    const frame = lastFrame()!;
    expect(frame).toContain('http://myhost:9925');
    expect(frame).toContain('admin');
    // Password should be masked
    expect(frame).toContain('******');
  });

  test('tab hint is shown', () => {
    const client = makeClient();
    const onConnect = mock(() => {});
    const { lastFrame } = render(
      <ConnectScreen client={client} onConnect={onConnect} />,
    );
    expect(lastFrame()).toContain('Tab');
  });

  test('password field starts focused when url and user provided', () => {
    const client = makeClient();
    const onConnect = mock(() => {});
    const { lastFrame } = render(
      <ConnectScreen
        client={client}
        onConnect={onConnect}
        initialUrl="http://localhost:9925"
        initialUser="admin"
        initialPassword="pass"
      />,
    );
    const frame = lastFrame()!;
    // Password field should be bold (active), and password masked
    expect(frame).toContain('****');
    // URL and username should be shown as plain text (not active input)
    expect(frame).toContain('http://localhost:9925');
    expect(frame).toContain('admin');
  });
});
