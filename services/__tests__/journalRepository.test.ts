import type { SupabaseClient } from '@supabase/supabase-js';
import { createJournalRepository } from '../journalRepository';
import type { SupabaseDreamRow } from '../journalDreamMapper';

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
