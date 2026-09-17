import { act, renderHook } from '@testing-library/react-native';
import { useJournalListPagination } from '../useJournalListPagination';

describe('journal presentation pagination', () => {
  it.each([0, 1, 1000, 1001, 2501])('shows all %i known dreams without omissions', length => {
    const items = Array.from({ length }, (_, id) => ({ id, title: `Dream ${id}` }));
    const { result } = renderHook(() => useJournalListPagination(items, 'account-a'));
    expect(result.current.visibleItems).toHaveLength(Math.min(40, length));
    while (result.current.hasMore) act(() => result.current.loadMore());
    expect(result.current.visibleItems).toEqual(items);
    expect(new Set(result.current.visibleItems.map(item => item.id)).size).toBe(length);
  });
  it('finds a dream beyond page one when filtering the full cache, and resets scope', () => {
    const items = Array.from({ length: 2501 }, (_, id) => ({ id, title: `Dream ${id}` }));
    const { result, rerender } = renderHook(({ query, account }: { query: string; account: string }) => useJournalListPagination(
      items.filter(item => item.title.includes(query)), `${account}:${query}`,
    ), { initialProps: { query: '', account: 'a' } });
    act(() => result.current.loadMore());
    expect(result.current.visibleItems).toHaveLength(80);
    rerender({ query: 'Dream 2500', account: 'a' });
    expect(result.current.visibleItems.map(item => item.id)).toEqual([2500]);
    expect(result.current.hasMore).toBe(false);
    rerender({ query: '', account: 'b' });
    expect(result.current.visibleItems).toHaveLength(40);
  });
});
