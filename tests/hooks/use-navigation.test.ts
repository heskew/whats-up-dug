import { describe, test, expect } from 'bun:test';
import { reducer, type NavigationState } from '../../src/hooks/use-navigation.js';

const initial: NavigationState = {
  stack: [{ screen: 'connect', params: {} }],
};

describe('navigation reducer', () => {
  test('PUSH adds entry to stack', () => {
    const result = reducer(initial, {
      type: 'PUSH',
      screen: 'dashboard',
      params: { url: 'http://localhost:9925' },
    });
    expect(result.stack).toHaveLength(2);
    expect(result.stack[1]).toEqual({
      screen: 'dashboard',
      params: { url: 'http://localhost:9925' },
    });
  });

  test('POP removes last entry', () => {
    const state: NavigationState = {
      stack: [
        { screen: 'connect', params: {} },
        { screen: 'dashboard', params: {} },
        { screen: 'database', params: { db: 'data' } },
      ],
    };
    const result = reducer(state, { type: 'POP' });
    expect(result.stack).toHaveLength(2);
    expect(result.stack[1].screen).toBe('dashboard');
  });

  test('POP from single-entry stack returns same state', () => {
    const result = reducer(initial, { type: 'POP' });
    expect(result).toBe(initial); // exact same object reference
  });

  test('RESET keeps only first entry', () => {
    const state: NavigationState = {
      stack: [
        { screen: 'connect', params: {} },
        { screen: 'dashboard', params: {} },
        { screen: 'database', params: { db: 'data' } },
      ],
    };
    const result = reducer(state, { type: 'RESET' });
    expect(result.stack).toHaveLength(1);
    expect(result.stack[0].screen).toBe('connect');
  });

  test('multiple pushes then pop maintains order', () => {
    let state = initial;
    state = reducer(state, { type: 'PUSH', screen: 'dashboard', params: {} });
    state = reducer(state, { type: 'PUSH', screen: 'database', params: { db: 'data' } });
    state = reducer(state, { type: 'PUSH', screen: 'table', params: { table: 'User' } });

    expect(state.stack).toHaveLength(4);

    state = reducer(state, { type: 'POP' });
    expect(state.stack).toHaveLength(3);
    expect(state.stack[2].screen).toBe('database');
  });

  test('unknown action returns same state', () => {
    const result = reducer(initial, { type: 'UNKNOWN' } as any);
    expect(result).toBe(initial);
  });
});
