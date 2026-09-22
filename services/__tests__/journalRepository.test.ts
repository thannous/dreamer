import type { SupabaseClient } from '@supabase/supabase-js';
import { createJournalRepository } from '../journalRepository';
import type { SupabaseDreamRow } from '../journalDreamMapper';
import { mapRowToDream } from '../journalDreamMapper';

const CREATED_AT = '2026-01-01T08:00:00.000Z';

const row = (id: number, overrides: Partial<SupabaseDreamRow> = {}): SupabaseDreamRow => ({
  id,
  created_at: CREATED_AT,
  transcript: `transcript-${id}`,
  title: `title-${id}`,
  interpretation: `interpretation-${id}`,
  shareable_quote: `quote-${id}`,
  image_url: null,
  chat_history: [],
  theme: 'calm',
  dream_type: 'Symbolic Dream',
  is_favorite: false,
  ...overrides,
});

type Result = { data: unknown; error: unknown };

/** Minimal PostgREST surface used by the repository; no network or SDK runtime is involved. */
function makeClient(
  plans: Result[],
  sessions: { id?: string; error?: Error | null }[],
  details: Result[] = []
) {
  const selectedColumns: string[] = [];
  const filters: [string, unknown][] = [];
  const auth = {
    getSession: jest.fn(async () => {
      const next = sessions.shift() ?? { id: 'user-a' };
      return {
        data: next.id ? { session: { user: { id: next.id } } } : { session: null },
        error: next.error ?? null,
      };
    }),
    getUser: jest.fn(async () => ({ data: { user: { id: 'user-a' } }, error: null })),
  };

  const from = jest.fn(() => {
    const query = {
      select(columns: string) {
        selectedColumns.push(columns);
        return query;
      },
      eq(field: string, value: unknown) {
        filters.push([field, value]);
        return query;
      },
      lte(field: string, value: unknown) {
        filters.push([field, value]);
        return query;
      },
      lt(field: string, value: unknown) {
        filters.push([field, value]);
        return query;
      },
      in(field: string, values: unknown[]) {
        filters.push([field, values]);
        return query;
      },
      order() {
        return query;
      },
      limit: jest.fn(async () => plans.shift() ?? { data: [], error: null }),
      single: jest.fn(async () => details.shift() ?? { data: null, error: null }),
      maybeSingle: jest.fn(async () => details.shift() ?? { data: null, error: null }),
    };
    return query;
  });

  return {
    client: { auth, from } as unknown as SupabaseClient,
    selectedColumns,
    filters,
    auth,
  };
}

describe('journal repository', () => {
  it('reuses unchanged server revisions and fetches only changed or new details', async () => {
    const unchanged = mapRowToDream(row(3, { revision_id: 'same', chat_history: [{ id: 'm', role: 'user', text: 'Full history' }] }));
    const stale = mapRowToDream(row(2, { revision_id: 'old' }));
    const deleted = mapRowToDream(row(4, { revision_id: 'gone' }));
    const mock = makeClient([
      { data: [{ id: 3, revision_id: 'same' }, { id: 2, revision_id: 'new' }, { id: 1, revision_id: 'added' }], error: null },
      { data: [row(1, { revision_id: 'added' }), row(2, { revision_id: 'new' })], error: null },
    ], []);
    const repository = createJournalRepository({ getClient: () => mock.client });
    const page = await repository.fetchDreamFullPage('user-a', { cachedDreams: new Map([[3, unchanged], [2, stale], [4, deleted]]) });
    expect(mock.selectedColumns).toEqual(['id,revision_id', '*']);
    expect(mock.filters).toContainEqual(['id', [2, 1]]);
    expect(page.items.map((dream) => dream.remoteId)).toEqual([3, 2, 1]);
    expect(page.items[0]).toBe(unchanged);
    expect(page.items[1].revisionId).toBe('new');
    expect(page.complete).toBe(false);
  });

  it('transfers no full details for an unchanged page and still checks the account', async () => {
    const cached = mapRowToDream(row(3, { revision_id: 'same' }));
    const mock = makeClient([{ data: [{ id: 3, revision_id: 'same' }], error: null }], []);
    const repository = createJournalRepository({ getClient: () => mock.client });
    await repository.fetchDreamFullPage('user-a', { cachedDreams: new Map([[3, cached]]) });
    expect(mock.selectedColumns).toEqual(['id,revision_id']);
    expect(mock.auth.getSession).toHaveBeenCalledTimes(2);
  });

  it('falls back to one full page when a bulk edit would require many detail requests', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => row(101 - index, { revision_id: 'new' }));
    const mock = makeClient([
      { data: rows.map(({ id, revision_id }) => ({ id, revision_id })), error: null },
      { data: rows, error: null },
    ], []);
    const repository = createJournalRepository({ getClient: () => mock.client });
    const page = await repository.fetchDreamFullPage('user-a', {
      cachedDreams: new Map([[101, mapRowToDream(row(101, { revision_id: 'old' }))]]),
    });
    expect(page.items).toHaveLength(101);
    expect(mock.selectedColumns).toEqual(['id,revision_id', '*']);
    expect(mock.filters.some(([, value]) => Array.isArray(value))).toBe(false);
  });

  it.each([
    { details: [] },
    { details: [row(99)] },
  ])('rejects a partial or foreign detail response instead of inferring deletions', async ({ details }) => {
    const mock = makeClient([
      { data: [{ id: 3, revision_id: 'new' }], error: null },
      { data: details, error: null },
    ], []);
    const repository = createJournalRepository({ getClient: () => mock.client });
    await expect(repository.fetchDreamFullPage('user-a', {
      cachedDreams: new Map([[3, mapRowToDream(row(3, { revision_id: 'old' }))]]),
    })).rejects.toThrow(/journal detail/);
  });
  it('uses the lightweight projection and preserves remote identity for equal timestamps', async () => {
    const mock = makeClient(
      [{ data: [row(18), row(17)], error: null }],
      [{ id: 'user-a' }, { id: 'user-a' }]
    );
    const repository = createJournalRepository({ getClient: () => mock.client, now: () => 1_735_689_600_000 });

    const page = await repository.fetchDreamListPage('user-a', { pageSize: 2 });

    expect(mock.selectedColumns).toEqual([
      'id,created_at,client_request_id,revision_id,updated_at,transcript,title,shareable_quote,exploration_started_at,image_url,dream_type,theme,is_favorite,memory,is_analyzed,analyzed_at,analysis_status,analysis_request_id,image_generation_failed',
    ]);
    expect(page.items.map((item) => item.remoteId)).toEqual([18, 17]);
    expect(page.items[0].id).toBe(page.items[1].id);
    expect(page.complete).toBe(false);
    expect(page.nextCursor).toMatchObject({ userId: 'user-a', highWatermark: 18, beforeId: 17 });
  });

  it('continues after a short page and ends only after an empty page', async () => {
    const mock = makeClient(
      [
        { data: [row(3), row(2)], error: null },
        { data: [row(1)], error: null },
        { data: [], error: null },
      ],
      Array.from({ length: 6 }, () => ({ id: 'user-a' }))
    );
    const repository = createJournalRepository({ getClient: () => mock.client });
    const pages = [];
    for await (const page of repository.iterateDreamPages('user-a', { pageSize: 2 })) pages.push(page);

    expect(pages).toHaveLength(3);
    expect(pages[0].items.map((item) => item.remoteId)).toEqual([3, 2]);
    expect(pages[1].items.map((item) => item.remoteId)).toEqual([1]);
    expect(pages[1].complete).toBe(false);
    expect(pages[2]).toMatchObject({ items: [], nextCursor: null, complete: true });
    expect(mock.filters.filter(([field]) => field === 'id')).toHaveLength(4);
  });

  it('uses full projection for detail reads and rejects an account change after the query', async () => {
    const clientA = makeClient(
      [],
      [{ id: 'user-a' }],
      [{ data: row(17), error: null }]
    );
    const clientB = makeClient([], [{ id: 'user-b' }]);
    const getClient = jest
      .fn()
      .mockReturnValueOnce(clientA.client)
      .mockReturnValueOnce(clientA.client)
      .mockReturnValueOnce(clientB.client);
    const repository = createJournalRepository({ getClient });

    await expect(repository.fetchDreamFromSupabase(17, 'user-a')).rejects.toThrow('Journal account changed');
    expect(clientA.selectedColumns).toEqual(['*']);
    expect(getClient).toHaveBeenCalledTimes(3);
  });

  it('rejects a malformed page response instead of publishing partial data', async () => {
    const mock = makeClient(
      [{ data: { not: 'an array' }, error: null }],
      [{ id: 'user-a' }, { id: 'user-a' }]
    );
    const repository = createJournalRepository({ getClient: () => mock.client });

    await expect(repository.fetchDreamFullPage('user-a')).rejects.toThrow('Invalid journal page response');
  });
});
