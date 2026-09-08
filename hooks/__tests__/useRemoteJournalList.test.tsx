import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useRemoteJournalList } from '../useRemoteJournalList';
import { fetchDreamListPage } from '@/services/supabaseDreamService';
import type { DreamListItem } from '@/lib/journalReadContracts';
jest.mock('@/services/supabaseDreamService', () => ({ fetchDreamListPage: jest.fn() }));
const fetchPage = jest.mocked(fetchDreamListPage);
const item = (id: number) => ({ id, remoteId: id, transcript: `Dream ${id}`, title: 'Night' } as DreamListItem);
beforeEach(() => jest.resetAllMocks());
it('keeps known rows after page failure and retries the failed cursor until empty sentinel', async () => {
  const cursor = { version: 1 as const, userId: 'a', highWatermark: 3, beforeId: 3 };
  fetchPage.mockResolvedValueOnce({ items: [item(3)], nextCursor: cursor, complete: false })
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ items: [item(2)], nextCursor: { ...cursor, beforeId: 2 }, complete: false })
    .mockResolvedValueOnce({ items: [], nextCursor: null, complete: true });
  const { result } = renderHook(() => useRemoteJournalList('a'));
  await waitFor(() => expect(result.current.items).toHaveLength(1));
  await act(async () => { await result.current.loadMore(); });
  expect(result.current.error).toBe(true);
  expect(result.current.items).toHaveLength(1);
  await act(async () => { await result.current.loadMore(); });
  expect(fetchPage.mock.calls[1]).toEqual(fetchPage.mock.calls[2]);
  expect(result.current.items).toHaveLength(2);
  expect(result.current.complete).toBe(false);
  await act(async () => { await result.current.loadMore(); });
  expect(result.current.complete).toBe(true);
});
it('discards pending responses from another account', async () => {
  let resolve!: (value: Awaited<ReturnType<typeof fetchDreamListPage>>) => void;
  fetchPage.mockImplementationOnce(() => new Promise(done => { resolve = done; }))
    .mockResolvedValueOnce({ items: [item(9)], nextCursor: null, complete: true });
  const { result, rerender } = renderHook(({ userId }: { userId: string }) => useRemoteJournalList(userId), { initialProps: { userId: 'a' } });
  rerender({ userId: 'b' });
  await waitFor(() => expect(result.current.items[0]?.id).toBe(9));
  await act(async () => { resolve({ items: [item(1)], nextCursor: null, complete: true }); });
  expect(result.current.items.map(row => row.id)).toEqual([9]);
});
