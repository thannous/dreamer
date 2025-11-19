import { describe, expect, it } from 'vitest';
import { sortWithSelectionFirst } from '../sorting';

describe('sortWithSelectionFirst', () => {
  const items = ['A', 'B', 'C', 'D'];

  it('should return original order if no selection is provided', () => {
    const result = sortWithSelectionFirst(items, undefined);
    expect(result).toEqual(items);
  });

  it('should place the selected item first if it exists in the list', () => {
    const result = sortWithSelectionFirst(items, 'C');
    expect(result[0]).toBe('C');
    expect(result).toHaveLength(4);
    expect(result).toEqual(expect.arrayContaining(items));
  });

  it('should place the selected item first even if it is NOT in the list', () => {
    const result = sortWithSelectionFirst(items, 'E');
    expect(result[0]).toBe('E');
    expect(result).toHaveLength(5);
    expect(result).toEqual(['E', 'A', 'B', 'C', 'D']);
  });

  it('should handle empty list', () => {
    const result = sortWithSelectionFirst([], 'A');
    expect(result).toEqual(['A']);
  });

  it('should handle empty list and no selection', () => {
    const result = sortWithSelectionFirst([], undefined);
    expect(result).toEqual([]);
  });
});
