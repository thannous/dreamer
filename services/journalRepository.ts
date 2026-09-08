import type { SupabaseClient } from '@supabase/supabase-js';
import { JournalTraversalError, type DreamListItem, type JournalPage, type JournalReadOptions } from '@/lib/journalReadContracts';
import type { DreamAnalysis } from '@/lib/types';
import { formatError } from '@/lib/journalErrors';
import { mapRowToDream, mapRowToDreamListItem, type SupabaseDreamRow } from './journalDreamMapper';

export function createJournalRepository({ getClient, now = () => Date.now() }: { getClient: () => SupabaseClient; now?: () => number }) {
  const DREAMS_TABLE = 'dreams';
  const JOURNAL_LIST_COLUMNS = 'id,created_at,client_request_id,revision_id,updated_at,transcript,title,shareable_quote,exploration_started_at,image_url,dream_type,theme,is_favorite,memory,is_analyzed,analyzed_at,analysis_status,analysis_request_id,image_generation_failed';

  async function resolveJournalUser(expectedUserId?: string): Promise<string> {
    const userId = expectedUserId ?? (await getClient().auth.getUser()).data.user?.id;
    if (!userId?.trim()) throw new Error('A user is required to read the journal');
    return userId;
  }

  async function assertJournalSession(userId: string): Promise<void> {
    const { data, error } = await getClient().auth.getSession();
    if (error || data.session?.user.id !== userId) throw new Error('Journal account changed');
  }

  async function readJournalPage<T>(
    userId: string,
    options: JournalReadOptions,
    columns: string,
    map: (row: SupabaseDreamRow) => T,
  ): Promise<JournalPage<T>> {
    const { cursor = null, pageSize = 500 } = options;
    if (!userId.trim()) throw new Error('A user is required to read the journal');
    if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error('Invalid journal page size');
    if (cursor && (cursor.version !== 1 || cursor.userId !== userId || !Number.isSafeInteger(cursor.highWatermark) ||
      !Number.isSafeInteger(cursor.beforeId) || cursor.beforeId <= 0 || cursor.highWatermark < cursor.beforeId)) {
      throw new Error('Invalid journal cursor or account scope');
    }
    try {
      await assertJournalSession(userId);
      let query = getClient().from(DREAMS_TABLE).select(columns).eq('user_id', userId);
      if (cursor) query = query.lte('id', cursor.highWatermark).lt('id', cursor.beforeId);
      const { data, error } = await query.order('id', { ascending: false }).limit(pageSize);
      await assertJournalSession(userId);
      if (error) throw formatError(error, 'Failed to load dreams from Supabase');
      if (!Array.isArray(data)) throw new Error('Invalid journal page response');
      const rows = data as unknown as SupabaseDreamRow[];
      if (!rows.length) return { items: [], nextCursor: null, complete: true };
      let previous = cursor?.beforeId ?? Infinity;
      for (const row of rows) {
        if (!Number.isSafeInteger(row.id) || row.id <= 0 || row.id >= previous) throw new Error('Invalid journal page ordering');
        previous = row.id;
      }
      return {
        items: rows.map(map), complete: false,
        nextCursor: { version: 1, userId, highWatermark: cursor?.highWatermark ?? rows[0].id, beforeId: rows[rows.length - 1].id },
      };
    } catch (error) {
      throw new JournalTraversalError(userId, cursor, error);
    }
  }

  function fetchDreamListPage(userId: string, options: JournalReadOptions = {}): Promise<JournalPage<DreamListItem>> {
    return readJournalPage(userId, options, JOURNAL_LIST_COLUMNS, (row) => mapRowToDreamListItem(row, now));
  }

  function fetchDreamFullPage(userId: string, options: JournalReadOptions = {}): Promise<JournalPage<DreamAnalysis>> {
    return readJournalPage(userId, options, '*', (row) => mapRowToDream(row, now));
  }

  /** Consumers can persist nextCursor after each consumed page and resume without replay. */
  async function* iterateDreamPages(userId: string, options: JournalReadOptions = {}): AsyncGenerator<JournalPage<DreamAnalysis>> {
    let cursor = options.cursor;
    for (;;) {
      const page = await fetchDreamFullPage(userId, { ...options, cursor });
      yield page;
      if (page.complete) return;
      cursor = page.nextCursor;
    }
  }

  /** Compatibility full snapshot: never returns a partial result after a page failure. */
  async function fetchDreamsFromSupabase(expectedUserId?: string): Promise<DreamAnalysis[]> {
    const userId = await resolveJournalUser(expectedUserId);
    const dreams: DreamAnalysis[] = [];
    for await (const page of iterateDreamPages(userId)) dreams.push(...page.items);
    return dreams;
  }

  async function fetchDreamFromSupabase(remoteId: number, expectedUserId?: string): Promise<DreamAnalysis> {
    if (!Number.isSafeInteger(remoteId) || remoteId <= 0) throw new Error('Invalid remote dream id');
    const userId = await resolveJournalUser(expectedUserId);
    await assertJournalSession(userId);
    const { data, error } = await getClient().from(DREAMS_TABLE).select('*').eq('user_id', userId).eq('id', remoteId).single();
    await assertJournalSession(userId);
    if (error) throw formatError(error, 'Failed to load dream from Supabase');
    if (!data) throw new Error('Failed to load dream from Supabase: Dream not found');
    return mapRowToDream(data, now);
  }

  async function fetchDreamByClientRequestId(clientRequestId: string, userId: string): Promise<DreamAnalysis | null> {
    if (!clientRequestId.trim() || !userId.trim()) throw new Error('Invalid dream lookup scope');
    await assertJournalSession(userId);
    const { data, error } = await getClient().from(DREAMS_TABLE).select('*').eq('user_id', userId).eq('client_request_id', clientRequestId).maybeSingle();
    await assertJournalSession(userId);
    if (error) throw formatError(error, 'Failed to load dream from Supabase');
    return data ? mapRowToDream(data, now) : null;
  }

  return { fetchDreamListPage, fetchDreamFullPage, iterateDreamPages, fetchDreamsFromSupabase, fetchDreamFromSupabase, fetchDreamByClientRequestId };
}
