import { useCallback, useEffect, useRef, useState } from 'react';
import type { DreamListItem, JournalCursor } from '@/lib/journalReadContracts';
import { fetchDreamListPage } from '@/services/supabaseDreamService';

export function useRemoteJournalList(userId: string) {
  const [state, setState] = useState({ userId, items: [] as DreamListItem[], loading: true, error: false, complete: false });
  const scope = useRef({ userId, active: true, loading: false, cursor: null as JournalCursor | null, complete: false });
  const loadMore = useCallback(async () => {
    const current = scope.current;
    if (!current.active || current.userId !== userId || current.loading || current.complete) return;
    current.loading = true;
    setState(previous => ({ ...previous, loading: true, error: false }));
    try {
      const page = await fetchDreamListPage(userId, { cursor: current.cursor, pageSize: 40 });
      if (!current.active || scope.current !== current) return;
      current.cursor = page.nextCursor;
      current.complete = page.complete;
      setState(previous => {
        const known = new Set(previous.items.map(item => item.remoteId));
        return { userId, items: [...previous.items, ...page.items.filter(item => !known.has(item.remoteId))], loading: false, error: false, complete: page.complete };
      });
    } catch {
      if (current.active && scope.current === current) setState(previous => ({ ...previous, loading: false, error: true }));
    } finally { current.loading = false; }
  }, [userId]);
  useEffect(() => {
    const current = { userId, active: true, loading: false, cursor: null, complete: false };
    scope.current = current;
    setState({ userId, items: [], loading: true, error: false, complete: false });
    void loadMore();
    return () => { current.active = false; };
  }, [userId, loadMore]);
  return { ...(state.userId === userId ? state : { userId, items: [], loading: true, error: false, complete: false }), loadMore };
}
