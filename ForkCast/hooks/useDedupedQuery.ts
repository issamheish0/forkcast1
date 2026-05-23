// hooks/useDedupedQuery.ts
// Wrapper to deduplicate concurrent queries and prevent refetch storms

import { useEffect, useRef, useState } from "react";
import { queryDeduper } from "@/utils/queryDeduper";

type UseDedupedQueryOptions<T> = {
  queryKey: string;
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number; // Time in ms before query is considered stale
};

export function useDedupedQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 5 * 60 * 1000, // 5 minutes default
}: UseDedupedQueryOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const lastFetchRef = useRef<number>(0);
  const dataRef = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;

    // Skip if data is still fresh
    if (dataRef.current && timeSinceLastFetch < staleTime) {
      return;
    }

    // Deduplicate and fetch
    setLoading(true);
    queryDeduper
      .dedupe(queryKey, queryFn)
      .then((result) => {
        dataRef.current = result;
        setData(result);
        lastFetchRef.current = Date.now();
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [queryKey, enabled, staleTime, queryFn]);

  return {
    data,
    loading,
    error,
    refetch: () => queryDeduper.dedupe(queryKey, queryFn),
  };
}
