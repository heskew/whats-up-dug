import React from 'react';
import { describe, test, expect, mock } from 'bun:test';
import { render } from 'ink-testing-library';
import { Text } from 'ink';
import { useApi } from '../../src/hooks/use-api.js';

/** Tiny component that exposes useApi state as text for assertion */
function TestHarness({ apiFn, immediate = false }: { apiFn: (...args: any[]) => Promise<any>; immediate?: boolean }) {
  const { data, loading, error, queryTime, execute, retry } = useApi(apiFn, immediate);
  // Stash execute/retry on a global so tests can call them
  (globalThis as any).__testExecute = execute;
  (globalThis as any).__testRetry = retry;
  return React.createElement(
    Text,
    null,
    JSON.stringify({ data, loading, error, queryTime: queryTime !== null ? 'set' : null }),
  );
}

function parseState(frame: string | undefined) {
  return JSON.parse(frame ?? '{}');
}

const tick = (ms = 50) => new Promise((r) => setTimeout(r, ms));

describe('useApi', () => {
  test('initial state is idle', () => {
    const apiFn = mock(() => Promise.resolve('ok'));
    const { lastFrame } = render(
      React.createElement(TestHarness, { apiFn }),
    );
    const state = parseState(lastFrame());
    expect(state.data).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  test('immediate=true triggers execute on mount', async () => {
    const apiFn = mock(() => Promise.resolve({ hello: 'world' }));
    const { lastFrame } = render(
      React.createElement(TestHarness, { apiFn, immediate: true }),
    );
    await tick();
    const state = parseState(lastFrame());
    expect(state.data).toEqual({ hello: 'world' });
    expect(state.loading).toBe(false);
    expect(state.queryTime).toBe('set');
    expect(apiFn).toHaveBeenCalledTimes(1);
  });

  test('execute resolves with data', async () => {
    const apiFn = mock(() => Promise.resolve('result'));
    const { lastFrame } = render(
      React.createElement(TestHarness, { apiFn }),
    );

    (globalThis as any).__testExecute('arg1');
    await tick();

    const state = parseState(lastFrame());
    expect(state.data).toBe('result');
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  test('execute sets error on rejection', async () => {
    const apiFn = mock(() => Promise.reject(new Error('boom')));
    const { lastFrame } = render(
      React.createElement(TestHarness, { apiFn }),
    );

    (globalThis as any).__testExecute();
    await tick();

    const state = parseState(lastFrame());
    expect(state.error).toBe('boom');
    expect(state.loading).toBe(false);
    expect(state.queryTime).toBe('set');
  });

  test('retry re-executes with last args', async () => {
    let callCount = 0;
    const apiFn = mock((...args: any[]) => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error('fail'));
      return Promise.resolve(`ok-${args[0]}`);
    });
    const { lastFrame } = render(
      React.createElement(TestHarness, { apiFn }),
    );

    // First call fails
    (globalThis as any).__testExecute('myarg');
    await tick();
    expect(parseState(lastFrame()).error).toBe('fail');

    // Retry should reuse 'myarg'
    (globalThis as any).__testRetry();
    await tick();
    const state = parseState(lastFrame());
    expect(state.data).toBe('ok-myarg');
    expect(state.error).toBeNull();
  });

  test('handles non-Error rejection', async () => {
    const apiFn = mock(() => Promise.reject('string error'));
    const { lastFrame } = render(
      React.createElement(TestHarness, { apiFn }),
    );

    (globalThis as any).__testExecute();
    await tick();

    const state = parseState(lastFrame());
    expect(state.error).toBe('string error');
  });
});
