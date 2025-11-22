import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Key = readonly unknown[] | string;

interface Options {
  dedupingInterval?: number;
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
  revalidateIfStale?: boolean;
}

interface CacheEntry<T> {
  data?: T;
  error?: unknown;
  timestamp?: number;
  promise?: Promise<T>;
}

const cache = new Map<string, CacheEntry<unknown>>();

function serializeKey(key: Key): string {
  return typeof key === "string" ? key : JSON.stringify(key);
}

function isStale(entry: CacheEntry<unknown> | undefined, dedupingInterval: number): boolean {
  if (!entry?.timestamp) return true;
  return Date.now() - entry.timestamp > dedupingInterval;
}

export function useSimpleSWR<K extends Key, T>(
  key: K | null,
  fetcher: (key: K) => Promise<T>,
  options?: Options,
): {
  data: T | undefined;
  error: unknown;
  isValidating: boolean;
  mutate: () => Promise<void>;
} {
  const dedupingInterval = options?.dedupingInterval ?? 0;
  const cacheKey = useMemo(() => (key === null ? null : serializeKey(key)), [key]);

  const [data, setData] = useState<T | undefined>(() => {
    if (!cacheKey) return undefined;
    return cache.get(cacheKey)?.data as T | undefined;
  });
  const [error, setError] = useState<unknown>(() => {
    if (!cacheKey) return undefined;
    return cache.get(cacheKey)?.error;
  });
  const [isValidating, setIsValidating] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const fetchAndUpdate = useCallback(
    async (force?: boolean) => {
      if (!cacheKey || key === null) return;

      const existing = cache.get(cacheKey) as CacheEntry<T> | undefined;
      const stale = isStale(existing, dedupingInterval);

      if (!force && existing?.promise && stale === false) {
        setIsValidating(true);
        try {
          await existing.promise;
        } finally {
          if (isMountedRef.current) setIsValidating(false);
        }
        return;
      }

      if (!force && existing && existing.data !== undefined && !stale) {
        return;
      }

      setIsValidating(true);
      const promise = fetcher(key as K)
        .then((result) => {
          cache.set(cacheKey, {
            data: result,
            error: undefined,
            timestamp: Date.now(),
          });
          if (isMountedRef.current) {
            setData(result);
            setError(undefined);
          }
          return result;
        })
        .catch((err) => {
          cache.set(cacheKey, {
            data: existing?.data,
            error: err,
            timestamp: Date.now(),
          });
          if (isMountedRef.current) {
            setError(err);
          }
          throw err;
        })
        .finally(() => {
          if (isMountedRef.current) setIsValidating(false);
        });

      cache.set(cacheKey, { ...existing, promise });
      await promise;
    },
    [cacheKey, dedupingInterval, fetcher, key],
  );

  useEffect(() => {
    if (!cacheKey || key === null) {
      setData(undefined);
      setError(undefined);
      setIsValidating(false);
      return;
    }

    const existing = cache.get(cacheKey) as CacheEntry<T> | undefined;
    if (existing) {
      setData(existing.data);
      setError(existing.error);
    }

    const stale = isStale(existing, dedupingInterval);
    if ((options?.revalidateIfStale ?? true) && stale) {
      void fetchAndUpdate(true);
    }
  }, [cacheKey, dedupingInterval, fetchAndUpdate, key, options?.revalidateIfStale]);

  useEffect(() => {
    if (!cacheKey || key === null || options?.revalidateOnFocus === false) return;

    const handler = () => void fetchAndUpdate(true);
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [cacheKey, fetchAndUpdate, key, options?.revalidateOnFocus]);

  useEffect(() => {
    if (!cacheKey || key === null || options?.revalidateOnReconnect === false) return;

    const handler = () => void fetchAndUpdate(true);
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [cacheKey, fetchAndUpdate, key, options?.revalidateOnReconnect]);

  const mutate = useCallback(async () => {
    await fetchAndUpdate(true);
  }, [fetchAndUpdate]);

  return { data, error, isValidating, mutate };
}
