import { useCallback, useEffect, useState } from 'react';

interface ListResponse<TItem> {
  list: TItem[];
  total: number;
}

export function useTable<TItem, TQuery>(
  fetcher: (params: TQuery) => Promise<ListResponse<TItem>>,
  initialQuery: TQuery,
) {
  const [list, setList] = useState<TItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [query, setQueryState] = useState(initialQuery);
  const [refreshKey, setRefreshKey] = useState(0);

  const setQuery = useCallback((patch: Partial<TQuery>) => {
    setQueryState((previous) => ({
      ...previous,
      ...patch,
    }));
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);

      try {
        const result = await fetcher(query);

        if (!cancelled) {
          setList(result.list);
          setTotal(result.total);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [fetcher, query, refreshKey]);

  return {
    list,
    total,
    loading,
    query,
    setQuery,
    refresh,
  };
}
