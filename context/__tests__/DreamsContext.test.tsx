/* @vitest-environment happy-dom */
import React from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { journal } = vi.hoisted(() => {
  const journal = {
    dreams: [{ id: 1, title: 'Dream', transcript: 'text', isAnalyzed: false }],
    loaded: true,
    addDream: vi.fn(async (dream) => dream),
    updateDream: vi.fn(async () => undefined),
    deleteDream: vi.fn(async () => undefined),
    toggleFavorite: vi.fn(async () => undefined),
    analyzeDream: vi.fn(async () => ({ id: 1 })),
  };

  return { journal };
});

vi.mock('../../hooks/useDreamJournal', () => ({
  useDreamJournal: () => journal,
}));

const { DreamsProvider, useDreams, useDreamsActions, useDreamsData } = await import('../DreamsContext');

describe('DreamsContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('given provider__when reading data__then exposes dreams and loaded', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DreamsProvider>{children}</DreamsProvider>
    );

    const { result } = renderHook(() => useDreamsData(), { wrapper });

    expect(result.current.dreams).toEqual(journal.dreams);
    expect(result.current.loaded).toBe(true);
  });

  it('given provider__when invoking actions__then delegates to journal', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DreamsProvider>{children}</DreamsProvider>
    );

    const { result } = renderHook(() => useDreamsActions(), { wrapper });

    await result.current.addDream({ id: 2 } as any);
    expect(journal.addDream).toHaveBeenCalledWith({ id: 2 });
  });

  it('given provider__when using combined hook__then returns data and actions', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DreamsProvider>{children}</DreamsProvider>
    );

    const { result } = renderHook(() => useDreams(), { wrapper });

    expect(result.current.dreams).toEqual(journal.dreams);
    expect(result.current.addDream).toBe(journal.addDream);
  });

  it('given missing provider__when using data hook__then throws', () => {
    expect(() => renderHook(() => useDreamsData())).toThrow(
      'useDreamsData must be used within DreamsProvider'
    );
  });
});
