import { useReducer, useCallback } from 'react';

export type ScreenName = 'connect' | 'dashboard' | 'database' | 'table' | 'record' | 'system';

export interface ScreenEntry {
  screen: ScreenName;
  params: Record<string, any>;
}

interface NavigationState {
  stack: ScreenEntry[];
}

type NavigationAction =
  | { type: 'PUSH'; screen: ScreenName; params: Record<string, any> }
  | { type: 'POP' }
  | { type: 'RESET' };

function reducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'PUSH':
      return {
        stack: [...state.stack, { screen: action.screen, params: action.params }],
      };
    case 'POP':
      if (state.stack.length <= 1) return state;
      return { stack: state.stack.slice(0, -1) };
    case 'RESET':
      return { stack: [state.stack[0]] };
    default:
      return state;
  }
}

export function useNavigation(initialScreen: ScreenName = 'connect') {
  const [state, dispatch] = useReducer(reducer, {
    stack: [{ screen: initialScreen, params: {} }],
  });

  const push = useCallback(
    (screen: ScreenName, params: Record<string, any> = {}) => {
      dispatch({ type: 'PUSH', screen, params });
    },
    [],
  );

  const pop = useCallback(() => {
    dispatch({ type: 'POP' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  const current = state.stack[state.stack.length - 1];

  return { current, stack: state.stack, push, pop, reset };
}
