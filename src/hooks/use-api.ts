import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  queryTime: number | null;
  execute: (...args: any[]) => Promise<void>;
  retry: () => Promise<void>;
}

export function useApi<T>(
  apiFn: (...args: any[]) => Promise<T>,
  immediate = false,
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryTime, setQueryTime] = useState<number | null>(null);
  const lastArgs = useRef<any[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args: any[]) => {
      lastArgs.current = args;
      setLoading(true);
      setError(null);
      const start = performance.now();
      try {
        const result = await apiFn(...args);
        if (!mountedRef.current) return;
        const elapsed = performance.now() - start;
        setData(result);
        setQueryTime(Math.round(elapsed));
      } catch (err: any) {
        if (!mountedRef.current) return;
        const elapsed = performance.now() - start;
        setQueryTime(Math.round(elapsed));
        const message =
          err?.message || err?.toString?.() || 'An unexpected error occurred';
        setError(message);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [apiFn],
  );

  const retry = useCallback(async () => {
    await execute(...lastArgs.current);
  }, [execute]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [immediate, execute]);

  return { data, loading, error, queryTime, execute, retry };
}
