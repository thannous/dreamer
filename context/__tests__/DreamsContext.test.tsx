/* @jest-environment jsdom */
import React from 'react';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const { mockJournal } = ((factory: any) => factory())(() => {
  const mockJournal = {
    dreams: [{ id: 1, title: 'Dream', transcript: 'text', isAnalyzed: false }],
    loaded: true,
    addDream: jest.fn(async (dream) => dream),
    updateDream: jest.fn(async () => undefined),
    deleteDream: jest.fn(async () => undefined),
    toggleFavorite: jest.fn(async () => undefined),
    analyzeDream: jest.fn(async () => ({ id: 1 })),
  };

  return { mockJournal };
});

jest.mock('../../hooks/useDreamJournal', () => ({
  useDreamJournal: () => mockJournal,
}));

const { DreamsProvider, useDreams, useDreamsActions, useDreamsData } = require('../DreamsContext');

describe('DreamsContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('given provider__when reading data__then exposes dreams and loaded', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DreamsProvider>{children}</DreamsProvider>
    );

    const { result } = renderHook(() => useDreamsData(), { wrapper });

    expect(result.current.dreams).toEqual(mockJournal.dreams);
    expect(result.current.loaded).toBe(true);
  });

  it('given provider__when invoking actions__then delegates to journal', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DreamsProvider>{children}</DreamsProvider>
    );

    const { result } = renderHook(() => useDreamsActions(), { wrapper });

    await result.current.addDream({ id: 2 } as any);
    expect(mockJournal.addDream).toHaveBeenCalledWith({ id: 2 });
  });

  it('given provider__when using combined hook__then returns data and actions', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DreamsProvider>{children}</DreamsProvider>
    );

    const { result } = renderHook(() => useDreams(), { wrapper });

    expect(result.current.dreams).toEqual(mockJournal.dreams);
    expect(result.current.addDream).toBe(mockJournal.addDream);
  });

  it('given missing provider__when using data hook__then throws', () => {
    expect(() => renderHook(() => useDreamsData())).toThrow(
      'useDreamsData must be used within DreamsProvider'
    );
  });
});
