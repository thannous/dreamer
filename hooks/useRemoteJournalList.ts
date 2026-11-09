import { useCallback, useEffect, useRef, useState } from 'react';
import type { DreamListItem, JournalCursor } from '@/lib/journalReadContracts';
import { fetchDreamListPage } from '@/services/supabaseDreamService';

export function useRemoteJournalList(userId: string) {
  const [state, setState] = useState({ userId, items: [] as DreamListItem[], loading: true, error: false, complete: false });
  const scope = useRef({ userId, active: true, loading: false, cursor: null as JournalCursor | null, complete: false });
  const fetchNextPage = useCallback((current: typeof scope.current) => {
    if (!current.active || current.userId !== userId || current.loading || current.complete) return;
    current.loading = true;
    const firstPage = current.cursor === null;
    return fetchDreamListPage(userId, { cursor: current.cursor, pageSize: 40 }).then(page => {
      if (!current.active || scope.current !== current) return;
      current.cursor = page.nextCursor;
      current.complete = page.complete;
      setState(previous => {
        const items = firstPage || previous.userId !== userId ? [] : previous.items;
        const known = new Set(items.map(item => item.remoteId));
        return { userId, items: [...items, ...page.items.filter(item => !known.has(item.remoteId))], loading: false, error: false, complete: page.complete };
      });
    }).catch(() => {
      if (current.active && scope.current === current) setState(previous => ({
        userId, items: firstPage || previous.userId !== userId ? [] : previous.items,
        loading: false, error: true, complete: false,
      }));
    }).finally(() => { current.loading = false; });
  }, [userId]);
  const loadMore = useCallback(async () => {
    const current = scope.current;
    if (!current.active || current.userId !== userId || current.loading || current.complete) return;
    setState(previous => ({ ...previous, loading: true, error: false }));
    await fetchNextPage(current);
  }, [fetchNextPage, userId]);
  // Account changes hide the old snapshot immediately. The first response
  // replaces it; only subsequent pages in the same traversal append rows.
  useEffect(() => {
    const current = { userId, active: true, loading: false, cursor: null, complete: false };
    scope.current = current;
    void fetchNextPage(current);
    return () => { current.active = false; };
  }, [userId, fetchNextPage]);
  return { ...(state.userId === userId ? state : { userId, items: [], loading: true, error: false, complete: false }), loadMore };
}
