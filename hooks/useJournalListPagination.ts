import { useCallback, useMemo, useState } from 'react';

/** Presentation window only: callers filter the entire known journal first. */
export function useJournalListPagination<T>(items: readonly T[], scopeKey: string, pageSize = 40) {
  const size = Math.max(1, Math.floor(pageSize));
  const [window, setWindow] = useState({ scopeKey, count: size });
  // Reset synchronously: changing account or filters must never expose the old window.
  if (window.scopeKey !== scopeKey) setWindow({ scopeKey, count: size });
  const count = window.scopeKey === scopeKey ? window.count : size;
  const visibleItems = useMemo(() => items.slice(0, count), [items, count]);
  const loadMore = useCallback(() => {
    setWindow(current => ({ scopeKey, count: Math.min(items.length, (current.scopeKey === scopeKey ? current.count : size) + size) }));
  }, [items.length, scopeKey, size]);
  return { visibleItems, loadMore, hasMore: count < items.length, total: items.length };
}
