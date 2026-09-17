import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PostgrestClient } from '@supabase/postgrest-js';
import { JournalTraversalError } from '@/lib/journalReadContracts';
import { fetchDreamListPage, iterateDreamPages } from '../supabaseDreamService';

// Exercise the installed SDK's URL/response contract, not a fluent-query mock.
// The transport simulates PostgREST's configured cap; this is not a live RLS test.
const mockTransport = jest.fn(async (_input: RequestInfo | URL): Promise<Response> => new Response('[]'));
const mockClient = new PostgrestClient('https://journal.invalid/rest/v1', { fetch: mockTransport });
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: (table: string) => mockClient.from(table),
    auth: {
      getUser: async () => ({ data: { user: { id: 'owner-a' } } }),
      getSession: async () => ({ data: { session: { user: { id: 'owner-a' } } } }),
    },
  },
}));
jest.mock('../dreamMediaService', () => ({ invalidateDreamMedia: jest.fn() }));

const makeRows = (count: number) => Array.from({ length: count }, (_, i) => ({
  id: count - i, created_at: '2026-09-08T00:00:00Z', user_id: 'owner-a',
  transcript: `Récit intégral ${count - i}`, title: `Rêve ${count - i}`,
  interpretation: 'Analyse complète', chat_history: [{ role: 'user', content: 'Un détail' }],
}));

beforeEach(() => { mockTransport.mockReset(); });

describe('Journal PostgREST transport contract', () => {
  it('streams an export beyond a lower server cap and resumes the failed request without duplicate rows', async () => {
    const rows = makeRows(2501);
    let failOnce = true;
    mockTransport.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get('user_id')).toBe('eq.owner-a');
      expect(url.searchParams.get('order')).toBe('id.desc');
      expect(url.searchParams.get('limit')).toBe('1000');
      const predicates = url.searchParams.getAll('id');
      const before = Number(predicates.find((p) => p.startsWith('lt.'))?.slice(3) ?? Infinity);
      const ceiling = Number(predicates.find((p) => p.startsWith('lte.'))?.slice(4) ?? Infinity);
      if (before === 1802 && failOnce) {
        failOnce = false;
        return new Response(JSON.stringify({ message: 'temporary failure', code: 'XX000' }), { status: 503 });
      }
      const page = rows.filter((r) => r.id < before && r.id <= ceiling).slice(0, 700);
      return new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    // An export sink consumes one full page at a time. No accumulating service snapshot.
    const exportedIds: number[] = [];
    let failure: JournalTraversalError | undefined;
    try {
      for await (const page of iterateDreamPages('owner-a', { pageSize: 1000 })) {
        exportedIds.push(...page.items.map((dream) => dream.remoteId!));
      }
    } catch (error) { failure = error as JournalTraversalError; }
    expect(failure).toBeInstanceOf(JournalTraversalError);
    expect(exportedIds).toHaveLength(700);
    for await (const page of iterateDreamPages('owner-a', { pageSize: 1000, cursor: failure!.cursor })) {
      exportedIds.push(...page.items.map((dream) => dream.remoteId!));
    }
    expect(exportedIds).toEqual(rows.map((row) => row.id));
    expect(new Set(exportedIds).size).toBe(2501);
    expect(mockTransport).toHaveBeenCalledTimes(6); // four data pages, failure, empty sentinel
  });

  it('requests only list columns and preserves the original long transcript', async () => {
    const transcript = 'é'.repeat(10000);
    mockTransport.mockImplementation(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const columns = url.searchParams.get('select')!.split(',');
      expect(columns).toContain('transcript');
      expect(columns).not.toContain('chat_history');
      expect(columns).not.toContain('analysis_details');
      expect(columns).not.toContain('interpretation');
      return new Response(JSON.stringify([{ ...makeRows(1)[0], transcript }]));
    });
    const page = await fetchDreamListPage('owner-a');
    expect(page.items[0].transcript).toBe(transcript);
    expect(page.items[0]).not.toHaveProperty('chatHistory');
    expect(page.complete).toBe(false);
  });
});
