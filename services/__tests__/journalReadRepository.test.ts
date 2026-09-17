import { fetchDreamFullPage, fetchDreamListPage, iterateDreamPages } from '../supabaseDreamService';
import { JournalTraversalError } from '@/lib/journalReadContracts';

let mockRows: Record<string, any>[] = [];
let mockCap = 1000;
let mockFailure = false;
let mockColumns = '';
let mockCalls = 0;
let mockUser: string | null = 'a';
let mockSwitchDuringPage = false;
jest.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: async () => ({ data: { session: mockUser ? { user: { id: mockUser } } : null } }) },
    from: () => {
      let owner = '';
      let before = Infinity;
      let watermark = Infinity;
      const query = {
        select: (columns: string) => { mockColumns = columns; return query; },
        eq: (_: string, value: string) => { owner = value; return query; },
        lt: (_: string, value: number) => { before = value; return query; },
        lte: (_: string, value: number) => { watermark = value; return query; },
        order: () => query,
        limit: async (size: number) => {
          mockCalls++;
          if (mockSwitchDuringPage) mockUser = 'b';
          if (mockFailure) return { data: null, error: { message: 'offline' } };
          return { data: mockRows.filter(row => row.user_id === owner && row.id < before && row.id <= watermark)
            .sort((a, b) => b.id - a.id).slice(0, Math.min(mockCap, size)), error: null };
        },
      };
      return query;
    },
  },
}));
jest.mock('../dreamMediaService', () => ({ invalidateDreamMedia: jest.fn() }));

const row = (id: number, user = 'a') => ({ id, user_id: user, created_at: '2020-01-01T00:00:00Z', transcript: 't', title: 'dream' });
const collect = async (cursor?: Parameters<typeof iterateDreamPages>[1]) => {
  const ids: number[] = [];
  for await (const page of iterateDreamPages('a', cursor)) ids.push(...page.items.map(item => item.remoteId!));
  return ids;
};
beforeEach(() => { mockRows = []; mockCap = 1000; mockFailure = false; mockCalls = 0; mockUser = 'a'; mockSwitchDuringPage = false; });

it.each([0, 1, 1000, 1001, 2501])('exhaustively traverses %i rows despite identical dates', async size => {
  mockRows = Array.from({ length: size }, (_, i) => row(i + 1));
  const ids = await collect();
  expect(ids).toHaveLength(size);
  expect(new Set(ids).size).toBe(size);
  expect(ids).toEqual(Array.from({ length: size }, (_, i) => size - i));
  expect(mockCalls).toBe(Math.ceil(size / 500) + 1);
});
it('continues past a short server-capped page until empty', async () => {
  mockRows = Array.from({ length: 101 }, (_, i) => row(i + 1)); mockCap = 7;
  expect(await collect({ pageSize: 1000 })).toHaveLength(101);
  expect(mockCalls).toBe(16);
});
it('excludes new insertions above watermark and does not skip after a deletion', async () => {
  mockRows = [row(1), row(2), row(3), row(4)];
  const first = await fetchDreamFullPage('a', { pageSize: 2 });
  mockRows = [row(1), row(2), row(4), row(5)];
  expect(await collect({ cursor: first.nextCursor })).toEqual([2, 1]);
  expect(await collect()).toEqual([5, 4, 2, 1]);
});
it('reports the failed cursor and resumes without replaying a consumed page', async () => {
  mockRows = [row(1), row(2), row(3)];
  const first = await fetchDreamFullPage('a', { pageSize: 2 });
  mockFailure = true;
  let failure: JournalTraversalError | undefined;
  try { await collect({ cursor: first.nextCursor }); } catch (error) { failure = error as JournalTraversalError; }
  expect(failure).toBeInstanceOf(JournalTraversalError);
  expect(failure?.complete).toBe(false);
  expect(failure?.cursor).toEqual(first.nextCursor);
  mockFailure = false;
  expect(await collect({ cursor: failure!.cursor })).toEqual([1]);
});
it('isolates accounts and rejects foreign or invalid cursors before querying', async () => {
  mockRows = [row(1), row(2, 'b')];
  const first = await fetchDreamFullPage('a');
  expect(first.items.map(item => item.remoteId)).toEqual([1]);
  const calls = mockCalls;
  await expect(fetchDreamFullPage('b', { cursor: first.nextCursor })).rejects.toThrow('account scope');
  expect(mockCalls).toBe(calls);
  await expect(fetchDreamFullPage('a', { cursor: { version: 1, userId: 'a', highWatermark: 1, beforeId: 2 } })).rejects.toThrow('cursor');
});
it('returns a distinct lightweight projection without truncating the transcript', async () => {
  mockRows = [{ ...row(1), transcript: 'a'.repeat(10000), interpretation: 'heavy', chat_history: [{ text: 'heavy' }] }];
  const page = await fetchDreamListPage('a');
  expect(page.items[0].transcript).toHaveLength(10000);
  expect(page.items[0]).not.toHaveProperty('interpretation');
  expect(page.items[0]).not.toHaveProperty('chatHistory');
  expect(mockColumns).not.toContain('analysis_details');
  expect(mockColumns).not.toContain('chat_history');
  expect(page.complete).toBe(false);
  const end = await fetchDreamListPage('a', { cursor: page.nextCursor });
  expect(end).toEqual({ items: [], complete: true, nextCursor: null });
});

it('reads later updates once without promising a historical snapshot', async () => {
  mockRows = [row(1), row(2), row(3)];
  const first = await fetchDreamFullPage('a', { pageSize: 1 });
  mockRows[1].transcript = 'edited after first page';
  const second = await fetchDreamFullPage('a', { cursor: first.nextCursor, pageSize: 1 });
  expect(second.items[0].remoteId).toBe(2);
  expect(second.items[0].transcript).toBe('edited after first page');
});

it('rejects a changed account during a response instead of completing', async () => {
  mockSwitchDuringPage = true;
  await expect(fetchDreamFullPage('a')).rejects.toThrow('Journal account changed');
});
it('rejects logout between pages before another request', async () => {
  mockRows = [row(1), row(2)];
  const first = await fetchDreamFullPage('a', { pageSize: 1 });
  mockUser = null;
  await expect(fetchDreamFullPage('a', { cursor: first.nextCursor })).rejects.toThrow('Journal account changed');
  expect(mockCalls).toBe(1);
});
